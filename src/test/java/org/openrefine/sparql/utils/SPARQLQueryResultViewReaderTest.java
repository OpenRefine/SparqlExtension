
package org.openrefine.sparql.utils;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.mockito.Mockito;
import org.mockito.MockitoAnnotations;
import org.openrefine.extensions.sparql.utils.SPARQLQueryResultViewReader;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import com.google.refine.ProjectManager;
import com.google.refine.ProjectMetadata;
import com.google.refine.RefineServlet;
import com.google.refine.importing.ImportingJob;
import com.google.refine.importing.ImportingManager;
import com.google.refine.io.FileProjectManager;
import com.google.refine.model.ModelException;
import com.google.refine.model.Project;

import okhttp3.HttpUrl;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;

public class SPARQLQueryResultViewReaderTest {

    private static final String ENDPOINT = "wdq/sparql";
    private static final String QUERY = "SELECT ?item ?itemLabel \n"
            + "WHERE \n"
            + "{\n"
            + "  ?item wdt:P31 wd:Q146. # Must be of a cat\n"
            + "  SERVICE wikibase:label { bd:serviceParam wikibase:language \"en,en\". } # Helps get the label in your language, if not, then en language\n"
            + "}";

    // dependencies
    private Project project;
    private ProjectMetadata metadata;
    private ImportingJob job;
    private RefineServlet servlet;

    // System under test
    private SPARQLQueryResultViewReader SUT = null;

    public static File createTempDirectory(String name)
            throws IOException {
        File dir = File.createTempFile(name, "");
        dir.delete();
        dir.mkdir();
        return dir;
    }

    @BeforeMethod
    public void setUp() throws IOException, ModelException {

        MockitoAnnotations.initMocks(this);

        File dir = createTempDirectory("OR_SPARQLExtension_Test_WorkspaceDir");
        FileProjectManager.initialize(dir);

        servlet = new RefineServlet();
        ImportingManager.initialize(servlet);
        project = new Project();
        metadata = new ProjectMetadata();
        job = Mockito.mock(ImportingJob.class);

        metadata.setName("SPARQL Import Test Project");
        ProjectManager.singleton.registerProject(project, metadata);

    }

    @AfterMethod
    public void tearDown() {
        SUT = null;
        project = null;
        metadata = null;
        job = null;
    }

    @Test
    public void testGetResults() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            String jsonResponse = "{\"head\":{\"vars\":[\"item\",\"itemLabel\"]},\"results\":{\"bindings\""
                    + ":[{\"item\":{\"type\":\"uri\",\"value\":\"http://www.wikidata.org/entity/Q378619\"},\"itemLabel\""
                    + ":{\"xml:lang\":\"en\",\"type\":\"literal\",\"value\":\"CC\"}},{\"item\":{\"type\":\"uri\",\"value\""
                    + ":\"http://www.wikidata.org/entity/Q498787\"},\"itemLabel\":{\"xml:lang\":\"en\",\"type\":\"literal\",\"value\":\"Muezza\"}}]}}";
            server.enqueue(new MockResponse().setBody(jsonResponse));
            server.start();

            HttpUrl url = server.url(ENDPOINT);
            SUT = new SPARQLQueryResultViewReader(job, url.toString(), QUERY);

            Assert.assertEquals(SUT.getColumns(), Arrays.asList("item", "itemLabel"));
        }
    }

    @Test
    public void testGetNextRowOfCells() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            String jsonResponse = "{\"head\":{\"vars\":[\"item\",\"itemLabel\"]},\"results\":{\"bindings\""
                    + ":[{\"item\":{\"type\":\"uri\",\"value\":\"http://www.wikidata.org/entity/Q378619\"},\"itemLabel\""
                    + ":{\"xml:lang\":\"en\",\"type\":\"literal\",\"value\":\"CC\"}},{\"item\":{\"type\":\"uri\",\"value\""
                    + ":\"http://www.wikidata.org/entity/Q498787\"},\"itemLabel\":{\"xml:lang\":\"en\",\"type\":\"literal\",\"value\":\"Muezza\"}}]}}";
            server.enqueue(new MockResponse().setBody(jsonResponse));
            server.start();

            HttpUrl url = server.url(ENDPOINT);
            SUT = new SPARQLQueryResultViewReader(job, url.toString(), QUERY);

            List<Object> currentRow = null;
            List<List<Object>> rows = new ArrayList<>();
            while ((currentRow = SUT.getNextRowOfCells()) != null) {
                rows.add(currentRow);
            }

            Assert.assertEquals(rows.get(0), Arrays.asList("item", "itemLabel"));
            Assert.assertEquals(rows.get(1), Arrays.asList("http://www.wikidata.org/entity/Q378619", "CC"));
        }
    }
}
