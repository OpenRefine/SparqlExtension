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
  this._parsingPanelElmts.sparql_options.html($.i18n('sparql-parsing/option'));
  this._parsingPanelElmts.previewButton.html($.i18n('sparql-parsing/preview-button'));
  this._parsingPanelElmts.sparql_updating.html($.i18n('sparql-parsing/updating-preview'));
  this._parsingPanelElmts.sparql_discard_next.html($.i18n('sparql-parsing/discard-next'));
  this._parsingPanelElmts.sparql_discard.html($.i18n('sparql-parsing/discard'));
  this._parsingPanelElmts.sparql_limit_next.html($.i18n('sparql-parsing/limit-next'));
  this._parsingPanelElmts.sparql_limit.html($.i18n('sparql-parsing/limit'));
  this._parsingPanelElmts.sparql_store_row.html($.i18n('sparql-parsing/store-row'));
  this._parsingPanelElmts.sparql_store_cell.html($.i18n('sparql-parsing/store-cell'));
  this._parsingPanelElmts.sparql_disable_auto_preview.text($.i18n('sparql-parsing/disable-auto-preview'));
  
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
    this._parsingPanelElmts.previewButton.on('click',function() { self._updatePreview(); });

    if (this._options.limit > 0) {
      this._parsingPanelElmts.limitCheckbox.prop("checked", true);
      this._parsingPanelElmts.limitInput[0].value = this._options.limit.toString();
    }
    if (this._options.skipDataLines > 0) {
      this._parsingPanelElmts.skipCheckbox.prop("checked", true);
      this._parsingPanelElmts.skipInput.value[0].value = this._options.skipDataLines.toString();
    }
    if (this._options.storeBlankRows) {
      this._parsingPanelElmts.storeBlankRowsCheckbox.prop("checked", true);
    }
    if (this._options.storeBlankCellsAsNulls) {
      this._parsingPanelElmts.storeBlankCellsAsNullsCheckbox.prop("checked", true);
    }

    if (this._options.disableAutoPreview) {
      this._parsingPanelElmts.disableAutoPreviewCheckbox.prop('checked', true);
    }

    // If disableAutoPreviewCheckbox is not checked, we will schedule an automatic update
    var onChange = function() {
      if (!self._parsingPanelElmts.disableAutoPreviewCheckbox[0].checked)
      {
        self._scheduleUpdatePreview();
      }
    };
    this._parsingPanel.find("input").on("change", onChange);
    this._parsingPanel.find("select").on("change", onChange);

    this._createProjectUI.showCustomPanel(this._parsingPanel);
    this._updatePreview();
};

Refine.SPARQLImportingController.prototype.getPreviewData = function(callback, numRows) {
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
  if ((this._formatParserUI) && this._formatParserUI.confirmReadyToCreateProject()) {
    var projectName = jQuery.trim(this._parsingPanelElmts.projectNameInput[0].value);
    if (projectName.length === 0) {
      window.alert($.i18n('core-index-import/warning-name'));
      this._parsingPanelElmts.projectNameInput.focus();
      return;
    }

    var projectTags = $("#tagsInput").val();

    var self = this;
    options.projectName = projectName;
    options.projectTags = projectTags;
    Refine.wrapCSRF(function(token) {
        $.post(
        "command/core/importing-controller?" + $.param({
            "controller": "core/default-importing-controller",
            "jobID": self._jobID,
            "subCommand": "create-project",
            "csrf_token": token
        }),
        {
            "format" : self._format,
            "options" : JSON.stringify(options)
        },
        function(o) {
            if (o.status == 'error') {
            alert(o.message);
            return;
            }
            
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
                    Refine.CreateProjectUI.cancelImportingJob(jobID);
                    document.location = "project?project=" + job.config.projectID;
                    },
                    function(job) {
                    alert($.i18n('core-index-import/errors')+'\n' + Refine.CreateProjectUI.composeErrorMessage(job));
                    self._onImportJobReady();
                    }
                );
            },
            1000
            );
            self._createProjectUI.showImportProgressPanel($.i18n('core-index-import/creating-proj'), function() {
            // stop the timed polling
            window.clearInterval(timerID);

            // explicitly cancel the import job
            Refine.CreateProjectUI.cancelImportingJob(self._jobID);

            self._createProjectUI.showSourceSelectionPanel();
            });
        },
        "json"
        );
    });
  }
};

Refine.TagsManager = {};
Refine.TagsManager.allProjectTags = [];

Refine.TagsManager._getAllProjectTags = function() {
    var self = this;
    if (self.allProjectTags.length === 0) {
        jQuery.ajax({
             url : "command/core/get-all-project-tags",
             success : function(result) {
                 var array = result.tags.sort(function (a, b) {
                     return a.toLowerCase().localeCompare(b.toLowerCase());
                     });
                                
                 array.map(function(item){
                     self.allProjectTags.push(item);
                 });
                 
                 },
                 async : false
                 });
        }
    return self.allProjectTags;
};
