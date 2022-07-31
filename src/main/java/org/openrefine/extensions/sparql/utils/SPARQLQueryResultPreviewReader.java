
package org.openrefine.extensions.sparql.utils;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.refine.importers.TabularImportingParserBase.TableDataReader;
import com.google.refine.importing.ImportingJob;

import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class SPARQLQueryResultPreviewReader implements TableDataReader {

    private static final Logger logger = LoggerFactory.getLogger("SPARQLImportingController");

    private final ImportingJob job;
    private String endpoint;
    private HttpUrl urlBase;
    private JsonNode results;
    private String query;
    private List<List<Object>> rowsOfCells = null;
    private JsonNode firstEntry;
    private List<String> columnNames = new ArrayList<String>();
    private int batchRowStart = 0;
    private boolean end = false;
    private boolean usedHeaders = false;
    private int nextRow = 0;
    private final int batchSize;
    private List<String> jsonRows = new ArrayList<String>();
    private int resultSize;
    private static int progress = 0;
    private int processedRows = 0;

    public SPARQLQueryResultPreviewReader(
            ImportingJob job,
            String endpoint,
            String query,
            int batchSize) throws IOException {

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
            List<Object> row = new ArrayList<Object>(columnNames.size());
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
            List<Object> result = rowsOfCells.get(nextRow++ - batchRowStart);
            if (nextRow >= batchSize) {
                rowsOfCells = getRowsOfCells(processedRows);
                processedRows = processedRows + rowsOfCells.size();

                if (logger.isDebugEnabled()) {
                    logger.debug("[[ Returning last row in batch:nextRow::{}, processedRows:{} ]]", nextRow, processedRows);
                }

                nextRow = 0;
                if (processedRows % 100 == 0) {
                    setProgress(job, "SPARQL", progress++);
                }
                if (processedRows % 10000 == 0) {
                    if (logger.isDebugEnabled()) {
                        logger.debug("[[ {} rows processed... ]]", processedRows);
                    }
                }
            }
            return result;
        } else {
            if (logger.isDebugEnabled()) {
                logger.debug("nextRow:{}, batchRowStart:{}", nextRow, batchRowStart);
            }

            return null;
        }

    }

    private List<List<Object>> getRowsOfCells(int newBatchRowStart) {

        List<List<Object>> rowsOfCells = new ArrayList<List<Object>>(batchSize);

        if (jsonRows != null && !jsonRows.isEmpty() && jsonRows.size() > 0) {

            List<Object> rowOfCells = new ArrayList<Object>(jsonRows.size());

            for (int j = 0; j < jsonRows.size() && j < columnNames.size(); j++) {

                String text = jsonRows.get(j);
                if (text == null || text.isEmpty()) {
                    rowOfCells.add(null);
                } else {

                    rowOfCells.add(text);
                }

            }
            rowsOfCells.add(rowOfCells);

        }
        end = jsonRows.size() < batchSize + 1;
        return rowsOfCells;
    }

    private static void setProgress(ImportingJob job, String querySource, int percent) {
        job.setProgress(percent, "Reading " + querySource);
    }
}
