
package org.openrefine.extensions.sparql.utils;

import java.io.IOException;
import java.io.Writer;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Properties;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.lang3.exception.ExceptionUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.refine.ProjectManager;
import com.google.refine.ProjectMetadata;
import com.google.refine.RefineServlet;
import com.google.refine.commands.HttpUtilities;
import com.google.refine.importers.TabularImportingParserBase;
import com.google.refine.importers.TabularImportingParserBase.TableDataReader;
import com.google.refine.importing.ImportingController;
import com.google.refine.importing.ImportingJob;
import com.google.refine.importing.ImportingManager;
import com.google.refine.model.Project;
import com.google.refine.util.JSONUtilities;
import com.google.refine.util.ParsingUtilities;

import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class SPARQLImportingController implements ImportingController {

    private static final Logger logger = LoggerFactory.getLogger("SPARQLImportingController");
    protected RefineServlet servlet;
    public static int DEFAULT_PREVIEW_LIMIT = 100;
    public static int DEFAULT_PROJECT_LIMIT = 0;
    public static int resultSize;

    @Override
    public void init(RefineServlet servlet) {
        this.servlet = servlet;

    }

    @Override
    public void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        HttpUtilities.respond(response, "error", "GET not implemented");

    }

    /* Handling of http requests between frontend and OpenRefine servlet */
    @Override
    public void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        if (logger.isDebugEnabled()) {
            logger.debug("doPost Query String::{}", request.getQueryString());
        }
        response.setCharacterEncoding("UTF-8");
        Properties parameters = ParsingUtilities.parseUrlParameters(request);

        String subCommand = parameters.getProperty("subCommand");

        if (logger.isDebugEnabled()) {
            logger.info("doPost::subCommand::{}", subCommand);
        }

        if ("initialize-parser-ui".equals(subCommand)) {
            doInitializeParserUI(request, response, parameters);
        } else if ("parse-preview".equals(subCommand)) {
            try {

                doParsePreview(request, response, parameters);

            } catch (Exception e) {
                logger.error("doPost::Exception::{}" + e);
                HttpUtilities.respond(response, "error", "Unable to parse preview");
            }
        } else if ("create-project".equals(subCommand)) {
            doCreateProject(request, response, parameters);
        } else {
            HttpUtilities.respond(response, "error", "No such sub command");
        }

    }

    /**
     * 
     * @param request
     * @param response
     * @param parameters
     * @throws ServletException
     * @throws IOException
     */
    private void doInitializeParserUI(HttpServletRequest request, HttpServletResponse response, Properties parameters)
            throws ServletException, IOException {
        if (logger.isDebugEnabled()) {
            logger.debug("::doInitializeParserUI::");
        }

        ObjectNode result = ParsingUtilities.mapper.createObjectNode();
        ObjectNode options = ParsingUtilities.mapper.createObjectNode();
        JSONUtilities.safePut(result, "status", "ok");
        JSONUtilities.safePut(result, "options", options);

        JSONUtilities.safePut(options, "skipDataLines", 0);
        JSONUtilities.safePut(options, "storeBlankRows", true);
        JSONUtilities.safePut(options, "storeBlankCellsAsNulls", true);
        if (logger.isDebugEnabled()) {
            logger.debug("doInitializeParserUI:::{}", result.toString());
        }

        HttpUtilities.respond(response, result.toString());

    }

    /**
     * doParsePreview
     * 
     * @param request
     * @param response
     * @param parameters
     * @throws ServletException
     * @throws IOException
     */
    private void doParsePreview(
            HttpServletRequest request, HttpServletResponse response, Properties parameters)
            throws ServletException, IOException {

        long jobID = Long.parseLong(parameters.getProperty("jobID"));
        ImportingJob job = ImportingManager.getJob(jobID);
        if (job == null) {
            HttpUtilities.respond(response, "error", "No such import job");
            return;
        }

        job.updating = true;
        ObjectNode optionObj = ParsingUtilities.evaluateJsonStringToObjectNode(
                request.getParameter("options"));

        List<Exception> exceptions = new LinkedList<Exception>();

        job.prepareNewProject();

        parsePreview(
                job.project,
                job.metadata,
                job,
                DEFAULT_PREVIEW_LIMIT,
                optionObj,
                exceptions);

        Writer w = response.getWriter();
        JsonGenerator writer = ParsingUtilities.mapper.getFactory().createGenerator(w);
        try {
            writer.writeStartObject();
            if (exceptions.size() == 0) {
                job.project.update(); // update all internal models, indexes, caches, etc.

                writer.writeStringField("status", "ok");
            } else {
                writer.writeStringField("status", "error");

                writer.writeArrayFieldStart("errors");
                writer.writeEndArray();
            }
            writer.writeEndObject();
        } catch (IOException e) {
            throw new ServletException(e);
        } finally {
            writer.flush();
            writer.close();
            w.flush();
            w.close();
        }

        job.touch();
        job.updating = false;
    }

    private static void parsePreview(
            Project project,
            ProjectMetadata metadata,
            final ImportingJob job,
            int limit,
            ObjectNode options,
            List<Exception> exceptions) throws IOException {

        JSONUtilities.safePut(options, "headerLines", 0);
        String endpoint = options.get("endpoint").asText();
        String query = options.get("query").asText();

        setProgress(job, "SPARQL", 0);

        TabularImportingParserBase.readTable(
                project,
                job,
                new SPARQLQueryResultPreviewReader(job, endpoint, query, 100),
                limit,
                options,
                exceptions);
        setProgress(job, "SPARQL", 100);

    }

    static private void setProgress(ImportingJob job, String category, int percent) {
        job.setProgress(percent, "Reading " + category);
    }

    static protected class SPARQLQueryResultPreviewReader implements TableDataReader {

        final ImportingJob job;
        String endpoint;
        HttpUrl urlBase;
        JsonNode results;
        String query;
        private List<List<Object>> rowsOfCells = null;
        JsonNode firstEntry;
        List<String> columnNames = new ArrayList<String>();
        private int batchRowStart = 0;
        private boolean end = false;
        private boolean usedHeaders = false;
        private int nextRow = 0;
        private final int batchSize;

        public SPARQLQueryResultPreviewReader(ImportingJob job, String endpoint, String query, int batchSize) throws IOException {

            this.job = job;
            this.endpoint = endpoint;
            this.query = query;
            this.batchSize = batchSize;
            getResults();

        }

        public void getResults() throws IOException {

            OkHttpClient client = new OkHttpClient.Builder().build();
            urlBase = HttpUrl.parse(endpoint).newBuilder()
                    .addQueryParameter("query", query)
                    .addQueryParameter("format", "json").build();

            Request request = new Request.Builder().url(urlBase).build();
            Response response = client.newCall(request).execute();
            JsonNode jsonNode = new ObjectMapper().readTree(response.body().string());
            results = jsonNode.path("results").path("bindings");
            resultSize = results.size();
            firstEntry = results.get(0);
            Iterator<String> iterator = firstEntry.fieldNames();
            iterator.forEachRemaining(e -> columnNames.add(e));
            List<String> jsonRows = new ArrayList<String>();

            for (int i = 0; i < resultSize; i++) {
                JsonNode jsonObject = results.get(i);
                Iterator<JsonNode> nodeIterator = jsonObject.elements();
                nodeIterator.forEachRemaining(valueNode -> {
                    if (valueNode.has("value"))
                        jsonRows.add(valueNode.get("value").asText());
                });
            }

        }

        @Override
        public List<Object> getNextRowOfCells() throws IOException {

            if (!usedHeaders) {
                List<Object> row = new ArrayList<Object>();
                for (String columnName : columnNames) {
                    row.add(columnName);
                }
                usedHeaders = true;

                return row;
            }

            if (rowsOfCells == null || (nextRow >= batchRowStart + rowsOfCells.size() && !end)) {
                int newBatchRowStart = batchRowStart + (rowsOfCells == null ? 0 : rowsOfCells.size());
                rowsOfCells = getRowsOfCells(newBatchRowStart);
                batchRowStart = newBatchRowStart;
                setProgress(job, "SPARQL", -1);
            }

            if (rowsOfCells != null && nextRow - batchRowStart < rowsOfCells.size()) {
                return rowsOfCells.get(nextRow++ - batchRowStart);
            } else {
                if (logger.isDebugEnabled()) {
                    logger.debug("nextRow:{}, batchRowStart:{}", nextRow, batchRowStart);
                }

                return null;
            }

        }

        private List<List<Object>> getRowsOfCells(int newBatchRowStart) {
            // TODO Auto-generated method stub
            return null;
        }

    }

    private void doCreateProject(HttpServletRequest request, HttpServletResponse response, Properties parameters)
            throws ServletException, IOException {

        long jobID = Long.parseLong(parameters.getProperty("jobID"));
        final ImportingJob job = ImportingManager.getJob(jobID);
        if (job == null) {
            HttpUtilities.respond(response, "error", "No such import job");
            return;
        }

        job.updating = true;
        final ObjectNode optionObj = ParsingUtilities.evaluateJsonStringToObjectNode(
                request.getParameter("options"));

        final List<Exception> exceptions = new LinkedList<Exception>();

        job.setState("creating-project");

        final Project project = new Project();
        new Thread() {

            @Override
            public void run() {
                ProjectMetadata pm = new ProjectMetadata();
                pm.setName(JSONUtilities.getString(optionObj, "projectName", "Untitled"));
                pm.setEncoding(JSONUtilities.getString(optionObj, "encoding", "UTF-8"));

                try {
                    parseCreate(
                            project,
                            pm,
                            job,
                            DEFAULT_PROJECT_LIMIT,
                            optionObj,
                            exceptions);
                } catch (IOException e) {
                    logger.error(ExceptionUtils.getStackTrace(e));
                }

                if (!job.canceled) {
                    if (exceptions.size() > 0) {
                        job.setError(exceptions);
                    } else {
                        project.update(); // update all internal models, indexes, caches, etc.

                        ProjectManager.singleton.registerProject(project, pm);

                        job.setState("created-project");
                        job.setProjectID(project.id);
                    }

                    job.touch();
                    job.updating = false;
                }
            }
        }.start();

        HttpUtilities.respond(response, "ok", "done");
    }

    private static void parseCreate(
            Project project,
            ProjectMetadata metadata,
            final ImportingJob job,
            int limit,
            ObjectNode options,
            List<Exception> exceptions) throws IOException {

        JSONUtilities.safePut(options, "headerLines", 0);
        String endpoint = options.get("endpoint").asText();
        String query = options.get("query").asText();

        setProgress(job, "Reading", 0);

        TabularImportingParserBase.readTable(
                project,
                job,
                new SPARQLQueryResultPreviewReader(job, endpoint, query, resultSize),
                limit,
                options,
                exceptions);
        setProgress(job, "Reading", 100);

    }

}
