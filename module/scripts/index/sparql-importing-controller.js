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

Refine.SPARQLImportingController.prototype.startImportingDocument = function(doc) {
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
            "endpoint" : JSON.stringify(doc.endpoint),
            "query" : JSON.stringify(doc.query),
            "csrf_token": token
            }),
            null,

            function(data2) {
                dismiss();

                if (data2.status == 'ok') {
                    self._doc = doc;
                    self._jobID = data.jobID;
                    self._options = data2.options;

                    self._showParsingPanel();
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

Refine.SPARQLImportingController.prototype.getOptions = function() {
  var options = {
    endpoint: this._doc.endpoint,
    query: this._doc.query,
  };

  return options;
};

Refine.SPARQLImportingController.prototype._showParsingPanel = function() {
  var self = this;
  
  this._parsingPanel.off().empty().html(
      DOM.loadHTML("sparql", "scripts/index/sparql-parsing-panel.html"));
      
  this._parsingPanelElmts = DOM.bind(this._parsingPanel);

  this._parsingPanelElmts.startOverButton.html($.i18n('sparql-parsing/start-over'));
  this._parsingPanelElmts.sparql_conf_pars.html($.i18n('sparql-parsing/conf-pars'));
  this._parsingPanelElmts.sparql_proj_name.html($.i18n('sparql-parsing/proj-name'));
  this._parsingPanelElmts.createProjectButton.html($.i18n('sparql-parsing/create-proj'));
  
  if (this._parsingPanelResizer) {
      $(window).off('resize', this._parsingPanelResizer);
    }

    this._parsingPanelResizer = function() {
      var elmts = self._parsingPanelElmts;
      var width = self._parsingPanel.width();
      var height = self._parsingPanel.height();
      var headerHeight = elmts.wizardHeader.outerHeight(true);
      var controlPanelHeight = 250;

      elmts.dataPanel
      .css("left", "0px")
      .css("top", headerHeight + "px")
      .css("width", (width - DOM.getHPaddings(elmts.dataPanel)) + "px")
      .css("height", (height - headerHeight - controlPanelHeight - DOM.getVPaddings(elmts.dataPanel)) + "px");
      elmts.progressPanel
      .css("left", "0px")
      .css("top", headerHeight + "px")
      .css("width", (width - DOM.getHPaddings(elmts.progressPanel)) + "px")
      .css("height", (height - headerHeight - controlPanelHeight - DOM.getVPaddings(elmts.progressPanel)) + "px");

      elmts.controlPanel
      .css("left", "0px")
      .css("top", (height - controlPanelHeight) + "px")
      .css("width", (width - DOM.getHPaddings(elmts.controlPanel)) + "px")
      .css("height", (controlPanelHeight - DOM.getVPaddings(elmts.controlPanel)) + "px");
    };

    $(window).on('resize',this._parsingPanelResizer);
    this._parsingPanelResizer();

    this._parsingPanelElmts.startOverButton.on('click',function() {
      // explicitly cancel the import job
      Refine.CreateProjectUI.cancelImportingJob(self._jobID);

      delete self._jobID;
      delete self._options;

      self._createProjectUI.showSourceSelectionPanel();
    });
    
    this._parsingPanelElmts.createProjectButton.on('click',function() { self._createProject(); });

    // If disableAutoPreviewCheckbox is not checked, we will schedule an automatic update
    var onChange = function() {
        self._scheduleUpdatePreview();
    };
    this._parsingPanel.find("input").on("change", onChange);
    this._parsingPanel.find("select").on("change", onChange);

    this._createProjectUI.showCustomPanel(this._parsingPanel);
    this._updatePreview();
};

Refine.SPARQLImportingController.prototype._scheduleUpdatePreview = function() {
    if (this._timerID != null) {
      window.clearTimeout(this._timerID);
      this._timerID = null;
    }

    var self = this;
    this._timerID = window.setTimeout(function() {
      self._timerID = null;
      self._updatePreview();
    }, 500); // 0.5 second
  };

Refine.SPARQLImportingController.prototype._updatePreview = function() {
    var self = this;
    this._parsingPanelElmts.dataPanel.hide();
    this._parsingPanelElmts.progressPanel.show();

    Refine.wrapCSRF(function(token) {
      $.post(
      "command/core/importing-controller?" + $.param({
        "controller": "sparql/sparql-importing-controller",
        "jobID": self._jobID,
        "subCommand": "parse-preview",
        "csrf_token": token
      }),
      
        {
          "options" : JSON.stringify(self.getOptions())
        },

        function(result) {
            if (result.status == "ok") {
                self._getPreviewData(function(projectData) {
                self._parsingPanelElmts.progressPanel.hide();
                self._parsingPanelElmts.dataPanel.show();

                new Refine.PreviewTable(projectData, self._parsingPanelElmts.dataPanel.off().empty());
            });
            } else {

            alert('Errors:\n' +  (result.message) ? result.message : Refine.CreateProjectUI.composeErrorMessage(job));
            self._parsingPanelElmts.progressPanel.hide();

            Refine.CreateProjectUI.cancelImportingJob(self._jobID);

            delete self._jobID;
            delete self._options;

            self._createProjectUI.showSourceSelectionPanel();

            }
        },
        "json"
        );
    });
  };

Refine.SPARQLImportingController.prototype._getPreviewData = function(callback, numRows) {
  var self = this;
  var result = {};

  $.post(
    "command/core/get-models?" + $.param({ "importingJobID" : self._jobID }),
    null,
    function(data) {
      for (var n in data) {
        if (data.hasOwnProperty(n)) {
          result[n] = data[n];
        }
      }

      $.post(
        "command/core/get-rows?" + $.param({
          "importingJobID" : self._jobID,
          "start" : 0,
          "limit" : numRows || 100 // More than we parse for preview anyway
        }),
        null,
		function(data) {
			  result.rowModel = data;
			  callback(result);
		  },
        "jsonp"
	   ).fail(() => { alert($.i18n('core-index/rows-loading-failed')); });
    },
    "json"
  );
};

Refine.SPARQLImportingController.prototype._createProject = function() {
  var projectName = $.trim(this._parsingPanelElmts.projectNameInput[0].value);
  if (projectName.length == 0) {
    window.alert("Please name the project.");
    this._parsingPanelElmts.projectNameInput.focus();
    return;
  }

  var self = this;
  var options = this.getOptions();
  options.projectName = projectName;
  Refine.wrapCSRF(function(token) {
    $.post(
        "command/core/importing-controller?" + $.param({
        "controller": "sparql/sparql-importing-controller",
        "jobID": self._jobID,
        "subCommand": "create-project",
        "csrf_token": token
        }),
        {
        "options" : JSON.stringify(options)
        },
        function(o) {
        if (o.status == 'error') {
            alert(o.message);
        } else {
            var start = new Date();
            var timerID = window.setInterval(
            function() {
                self._createProjectUI.pollImportJob(
                    start,
                    self._jobID,
                    timerID,
                    function(job) {
                    return "projectID" in job.config;
                    },
                    function(jobID, job) {
                    window.clearInterval(timerID);
                    Refine.CreateProjectUI.cancelImportingJob(jobID);
                    document.location = "project?project=" + job.config.projectID;
                    },
                    function(job) {
                    alert(Refine.CreateProjectUI.composeErrorMessage(job));
                    }
                );
            },
            1000
            );
            self._createProjectUI.showImportProgressPanel($.i18n('sparql-import/creating'), function() {
            // stop the timed polling
            window.clearInterval(timerID);

            // explicitly cancel the import job
            Refine.CreateProjectUI.cancelImportingJob(jobID);

            delete self._jobID;
            delete self._options;

            self._createProjectUI.showSourceSelectionPanel();
            });
        }
        },
        "json"
    );
  });
};
