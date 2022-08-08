package org.openrefine.sparql.utils;

import java.io.File;
import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.MockitoAnnotations;
import org.openrefine.extensions.sparql.utils.SPARQLQueryResultPreviewReader;
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

public class SPARQLQueryResultPreviewReaderTest {

    private static final String JSON_OPTION = "{\"mode\":\"row-based\"}}";
    private static final String ENDPOINT = "https://dummy.endpoint.org/sparql";
    private static final String QUERY = "dummy query";
    private static final int BATCH_SIZE = 100;

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
    private SPARQLQueryResultPreviewReader SUT = null;

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
        SUT = new SPARQLQueryResultPreviewReader(job, ENDPOINT, QUERY, BATCH_SIZE);

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
  public void f() {
  }
}
