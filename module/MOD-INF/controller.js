/*
 * Controller for SPARQL extension.
 * 
 * This is run in the Butterfly (ie Refine) server context using the Rhino
 * Javascript interpreter.
 */

var html = "text/html";
var encoding = "UTF-8";
var version = "0.3";
var ClientSideResourceManager = Packages.com.google.refine.ClientSideResourceManager;

/*
 * Function invoked to initialize the extension.
 */
function init() {
	
	// Register importer and exporter
  var IM = Packages.com.google.refine.importing.ImportingManager;
  
  IM.registerController(
    module,
    "sparql-importing-controller",
    new Packages.org.openrefine.extensions.sparql.utils.SPARQLImportingController()
  );
 
  // Script files to inject into /index page
  ClientSideResourceManager.addPaths(
    "index/scripts",
    module,
    [
      "scripts/index/sparql-importing-controller.js",
      "scripts/index/sparql-source-ui.js"
    ]
  );
  
    
  // Style files to inject into /index page
  ClientSideResourceManager.addPaths(
    "index/styles",
    module,
    [
      "styles/sparql-import.less",
      "styles/theme.less"
    ]
  );

}
