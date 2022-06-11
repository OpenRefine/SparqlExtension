//Internationalization init
var lang = navigator.language.split("-")[0]
		|| navigator.userLanguage.split("-")[0];
var dictionary = "";
$.ajax({
	url : "command/core/load-language?",
	type : "POST",
	async : false,
	data : {
	  module : "sparql",
//		lang : lang
	},
	success : function(data) {
		dictionary = data['dictionary'];
                lang = data['lang'];
	}
});
$.i18n().load(dictionary, lang);
// End internationalization

Refine.SPARQLImportingController = function(createProjectUI) {
  this._createProjectUI = createProjectUI;
  
  this._parsingPanel = createProjectUI.addCustomPanel();

  createProjectUI.addSourceSelectionUI({
    label: $.i18n('sparql-import/importer-name'),
    id: "sparql-source",
    ui: new Refine.SPARQLSourceUI(this)
  });
  
};
Refine.CreateProjectUI.controllers.push(Refine.SPARQLImportingController);

Refine.SPARQLImportingController.prototype.startImportingDocument = function(json) {
  var dismiss = DialogSystem.showBusy($.i18n('sparql-import/preparing'));
  var self = this;
  Refine.postCSRF(
    "command/core/create-importing-job",
    null,
    function(data) {
      Refine.wrapCSRF(function(token) {
        $.post(
            "command/core/importing-controller?" + $.param({
            "controller": "sparql/sparql-importing-controller",
            "subCommand": "initialize-parser-ui",
            "csrf_token": token
            }),
            null,

            function(data2) {
                dismiss();

                if (data2.status == 'ok') {
                    self._doc = json;
                    self._jobID = data.jobID;
                    self._options = data2.options;

                    //self._showParsingPanel();
                } else {
                    alert(data2.message);
                }
            },
            "json"
        );
      });
    },
    "json"
  );
};


