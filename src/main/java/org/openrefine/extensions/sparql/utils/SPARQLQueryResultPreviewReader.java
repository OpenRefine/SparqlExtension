
package org.openrefine.extensions.sparql.utils;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.openrefine.extensions.sparql.model.JsonColumn;
import org.openrefine.extensions.sparql.model.JsonRow;
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

    private static final Logger logger = LoggerFactory.getLogger("SPARQLQueryResultPreviewReader");

    private final ImportingJob job;
    private String endpoint;
    private HttpUrl urlBase;
    private JsonNode results;
    private String query;
    private final int batchSize;
    private List<List<Object>> rowsOfCells = null;
    private int nextRow = 0;
    private int batchRowStart = 0;
    private int processedRows = 0;
    private static int progress = 0;
    private boolean end = false;
    private int resultSize;
    private List<String> jsonRows = new ArrayList<String>();
    private List<String> columns = new ArrayList<String>();
    private JsonNode firstEntry;
    private List<JsonColumn> jsonColumns = new ArrayList<JsonColumn>();
    private boolean usedHeaders = false;

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
        iterator.forEachRemaining(e -> columns.add(e));
        jsonColumns.add(new JsonColumn(columns));

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

        if (rowsOfCells == null || (nextRow >= batchRowStart + rowsOfCells.size() && !end)) {
            int newBatchRowStart = batchRowStart + (rowsOfCells == null ? 0 : rowsOfCells.size());
            rowsOfCells = getRowsOfCells(newBatchRowStart);
            processedRows = processedRows + rowsOfCells.size();
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
                logger.debug("[[processedRows:{} ]]", processedRows);
            }
            return null;
        }

    }

    private List<List<Object>> getRowsOfCells(int startRow) throws IOException {
        logger.info("Entry getRowsOfCells::startRow:" + startRow);

        List<List<Object>> rowsOfCells = new ArrayList<List<Object>>(batchSize);

        List<JsonRow> jsonRows = getRows();
        List<String> row = new ArrayList<String>();
        int start = 0;

        if (jsonRows != null && !jsonRows.isEmpty() && jsonRows.size() > 0) {

            for (JsonRow jsonRow : jsonRows) {
                row = jsonRow.getValues();
            }
            List<Object> rowOfCells = new ArrayList<Object>(row.size());
            logger.info("For loop getRowsOfCells::rows:{}", row);
            
            while (start <= row.size() / columns.size()) {
                int end = start + columns.size() - 1;
                for (int i = start; i <= end; i++) {

                    rowOfCells.add(row.get(i));
                    rowsOfCells.add(rowOfCells);
                }
               // rowsOfCells.add(rowOfCells);
               start = end + 1;
            }

       }
        end = jsonRows.size() < batchSize + 1;
        logger.info("Exit::getRowsOfCells::rowsOfCells:{}", rowsOfCells);
        return rowsOfCells;

    }

    private List<JsonRow> getRows() {
        int index = 0;
        int start = 0;
        List<JsonRow> rows = new ArrayList<JsonRow>();
        JsonRow row = new JsonRow();
        row.setIndex(index);
        List<String> values = new ArrayList<String>(columns.size());

        while (start <= jsonRows.size() / columns.size()) {
            int end = start + columns.size() - 1;
            for (int i = start; i <= end; i++) {

                values.add(jsonRows.get(i));

            }
            row.setValues(values);
            rows.add(row);
            index++;
            start = end + 1;
        }

        return rows;
    }

    static private void setProgress(ImportingJob job, String querySource, int percent) {
        job.setProgress(percent, "Reading " + querySource);
    }

}
