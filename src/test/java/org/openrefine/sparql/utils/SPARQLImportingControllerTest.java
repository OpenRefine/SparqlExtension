
package org.openrefine.sparql.utils;

import static org.mockito.Mockito.when;

import java.io.File;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openrefine.extensions.sparql.utils.SPARQLImportingController;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.refine.ProjectManager;
import com.google.refine.ProjectMetadata;
import com.google.refine.RefineServlet;
import com.google.refine.importing.ImportingJob;
import com.google.refine.importing.ImportingManager;
import com.google.refine.io.FileProjectManager;
import com.google.refine.model.ModelException;
import com.google.refine.model.Project;
import com.google.refine.util.ParsingUtilities;

public class SPARQLImportingControllerTest {

    private static final String JSON_OPTION = "{\"mode\":\"row-based\"}}";

    private String query;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    // dependencies
    private Project project;
    private ProjectMetadata metadata;
    private ImportingJob job;
    private RefineServlet servlet;

    // System under test
    private SPARQLImportingController SUT = null;

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

        metadata.setName("SPARQL Import Test Project");
        ProjectManager.singleton.registerProject(project, metadata);
        SUT = new SPARQLImportingController();

    }

    @AfterMethod
    public void tearDown() {
        SUT = null;
        request = null;
        response = null;
        project = null;
        metadata = null;
        job = null;
    }

    @Test
    public void testDoGet() {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);

        try {
            when(response.getWriter()).thenReturn(pw);

            SUT.doGet(request, response);

            String result = sw.getBuffer().toString().trim();
            ObjectNode json = ParsingUtilities.mapper.readValue(result, ObjectNode.class);
            String code = json.get("status").asText();
            String message = json.get("message").asText();
            Assert.assertNotNull(code);
            Assert.assertNotNull(message);
            Assert.assertEquals(code, "error");
            Assert.assertEquals(message, "GET not implemented");

        } catch (Exception e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
    }

    @Test
    public void testDoPostInvalidSubCommand() throws IOException, ServletException {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        when(request.getQueryString()).thenReturn(
                "http://127.0.0.1:3333/command/core/importing-controller?controller=sparql/sparql-import-controller&subCommand=invalid-sub-command");

        when(response.getWriter()).thenReturn(pw);
        // test
        SUT.doPost(request, response);

        String result = sw.getBuffer().toString().trim();
        ObjectNode json = ParsingUtilities.mapper.readValue(result, ObjectNode.class);

        String code = json.get("status").asText();
        String message = json.get("message").asText();
        Assert.assertNotNull(code);
        Assert.assertNotNull(message);
        Assert.assertEquals(code, "error");
        Assert.assertEquals(message, "No such sub command");
    }
}
