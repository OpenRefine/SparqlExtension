package org.openrefine.extensions.sparql.utils;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.refine.importers.TabularImportingParserBase.TableDataReader;
import com.google.refine.importing.ImportingJob;

import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class SPARQLQueryResultPreviewReader implements TableDataReader {

    final ImportingJob job;
    String endpoint;
    HttpUrl urlBase;
    JsonNode results;
    String query;
    private int indexRow = 0;
    List<Object> rowsOfCells;

    public SPARQLQueryResultPreviewReader(ImportingJob job, String endpoint, String query) throws IOException {

        this.job = job;
        this.endpoint = endpoint;
        this.query = query;
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

    }

    @Override
    public List<Object> getNextRowOfCells() throws IOException {

        if (results.size() > 0) {
            setProgress(job, "Reading", 100 * indexRow / results.size());
        } else if (indexRow == results.size()) {
            setProgress(job, "Reading", 100);
        }

        if (indexRow < results.size()) {
            rowsOfCells = Collections.singletonList(results.get(indexRow++).findValue("value").asText());

            return rowsOfCells;

        } else {
            return null;
        }

    }

    static private void setProgress(ImportingJob job, String querySource, int percent) {
        job.setProgress(percent, "Reading " + querySource);
    }

}
