/*
 * Controller for SPARQL extension.
 * 
 * This is run in the Butterfly (ie Refine) server context using the Rhino
 * Javascript interpreter.
 */

var html = "text/html";
var encoding = "UTF-8";
var version = "0.1";
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
      "scripts/index/parsing-panel.js",
      "scripts/index/sparql-source-ui.js",
      "scripts/index/json-parser-ui.js",
      "scripts/index/wikidata/Sparql.js",
      "scripts/index/codemirror.js",
      "scripts/index/Editor.js",
      //"scripts/index/fullscreen.js",
      "scripts/index/getMessage.js",
      "scripts/index/jquery.js",
      "scripts/index/placeholder.js",
      "scripts/index/Rdf.js",
      "scripts/index/RdfNamespaces.js",
      "scripts/index/show-hint.js",
      "scripts/index/sparql.js",
      "scripts/index/underscore.js",
      "scripts/index/Wikibase.js",
      "scripts/index/hint/Sparql.js",
      "scripts/index/tooltip/Rdf.js"
    ]
  );
  
  // Script files to inject into /project page
  ClientSideResourceManager.addPaths(
    "project/scripts",
    module,
    [
      "scripts/index/sparql-importing-controller.js",
      "scripts/index/parsing-panel.js",
      "scripts/index/sparql-source-ui.js",
      "scripts/index/json-parser-ui.js",
      "scripts/index/wikidata/Sparql.js"
    ]
  );
  
  // Style files to inject into /index page
  ClientSideResourceManager.addPaths(
    "index/styles",
    module,
    [
      "styles/sparql-import.less",
      "styles/theme.less",
      "styles/bootstrap.css",
      "styles/codemirror.css",
      //"styles/fullscreen.css",
      "styles/show-hint.css"
    ]
  );

}
