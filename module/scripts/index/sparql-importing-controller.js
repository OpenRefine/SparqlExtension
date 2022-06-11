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

Refine.SPARQLImportingController.prototype._startOver = function() {
  if (this._jobID) {
    Refine.CreateProjectUI.cancelImportingJob(this._jobID);
  }

  delete this._parsingPanelElmts;

  delete this._jobID;
  delete this._job;
  delete this._extensions;

  delete this._format;
  delete this._parserOptions;
  delete this._projectName;

  this._createProjectUI.showSourceSelectionPanel();
};

Refine.SPARQLImportingController.prototype.startImportJob = function(form, progressMessage, callback) {
  var self = this;
  
  Refine.wrapCSRF(function(token) {
    $.post(
        "command/core/create-importing-job",
        { csrf_token: token },
        function(data) {
            var jobID = self._jobID = data.jobID;

            form.attr("method", "post")
            .attr("enctype", "multipart/form-data")
            .attr("accept-charset", "UTF-8")
            .attr("target", "create-project-iframe")
            .attr("action", "command/core/importing-controller?" + $.param({
            "controller": "core/default-importing-controller",
            "jobID": jobID,
            "subCommand": "load-raw-data",
            "csrf_token": token
            }));
            form[0].submit();

            var start = new Date();
            var timerID = window.setInterval(
            function() {
                self._createProjectUI.pollImportJob(
                start, jobID, timerID,
                function(job) {
                    return job.config.hasData;
                },
                function(jobID, job) {
                    self._job = job;
                    self._showParsingPanel(false);
                    if (callback) {
                    callback(jobID, job);
                    }
                },
                function(job) {
                    alert(job.config.error + '\n' + job.config.errorDetails);
                    self._startOver();
                }
                );
            },
            1000
            );
            self._createProjectUI.showImportProgressPanel(progressMessage, function() {
            // stop the iframe
            $('#create-project-iframe')[0].contentWindow.stop();

            // stop the timed polling
            window.clearInterval(timerID);

            // explicitly cancel the import job
            Refine.CreateProjectUI.cancelImportingJob(jobID);

            self._createProjectUI.showSourceSelectionPanel();
            });
        },
        "json"
    );
  });
};

Refine.SPARQLImportingController.prototype._showParsingPanel = function(hasFileSelection) {
  var self = this;

  if (!(this._format)) {
    this._format = this._job.config.rankedFormats[0];
  }
  if (!(this._parserOptions)) {
    this._parserOptions = {};
  }
  if (this._formatParserUI) {
    this._formatParserUI.dispose();
    delete this._formatParserUI;
  }
  
  this._prepareParsingPanel();
  this._parsingPanelElmts.nextButton.on('click',function() {
    self._createProject();
  });
  if (hasFileSelection) {
    this._parsingPanelElmts.previousButton.on('click',function() {
      self._createProjectUI.showCustomPanel(self._fileSelectionPanel);
    });
  } else {
    this._parsingPanelElmts.previousButton.hide();
  }

  if (!(this._projectName) && this._job.config.fileSelection.length > 0) {
    var index = this._job.config.fileSelection[0];
    var record = this._job.config.retrievalRecord.files[index];
    if (record.fileName == '(clipboard)') {
      this._projectName = $.i18n('core-index-import/clipboard');
    } else {
      this._projectName = jQueryTrim(record.fileName.replace(/[\._-]/g, ' ').replace(/\s+/g, ' '));
    }
  }
  if (this._projectName) {
    this._parsingPanelElmts.projectNameInput[0].value = this._projectName;
  }

  this._createProjectUI.showCustomPanel(this._parsingPanel);
};

Refine.SPARQLImportingController.prototype._prepareParsingPanel = function() {
  var self = this;

  this._parsingPanel.off().empty().html(
      DOM.loadHTML("core", "scripts/index/default-importing-controller/parsing-panel.html"));

  this._parsingPanelElmts = DOM.bind(this._parsingPanel);
  this._parsingPanelElmts.startOverButton.on('click',function() {
    self._startOver();
  });
  this._parsingPanelElmts.progressPanel.hide();

  this._parsingPanelElmts.previousButton.html($.i18n('core-buttons/previous'));
  this._parsingPanelElmts.startOverButton.html($.i18n('core-buttons/startover'));
  this._parsingPanelElmts.nextButton.html($.i18n('core-buttons/create-project'));
  $('#or-import-parsopt').text($.i18n('core-index-import/parsing-options'));
  $('#or-import-projname').html($.i18n('core-index-import/project-name'));
  $('#or-import-projtags').html($.i18n('core-index-import/project-tags'));
  $('#or-import-updating').text($.i18n('core-index-import/updating-preview'));
  $('#or-import-parseas').text($.i18n('core-index-import/parse-as'));

  //tags dropdown
  $("#tagsInput").select2({
    data: Refine.TagsManager._getAllProjectTags() ,
    tags: true,
    tokenSeparators: [",", " "]
  });
  
  this._parsingPanelResizer = function() {
    var elmts = self._parsingPanelElmts;
    var width = self._parsingPanel.width();
    var height = self._parsingPanel.height();
    var headerHeight = elmts.wizardHeader.outerHeight(true);
    var controlPanelHeight = 300;

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

  var formats = this._job.config.rankedFormats;
  var createFormatTab = function(format) {
    var formatLabelKey =Refine.importingConfig.formats[format].label;
    var tab = $('<div>')
    .text( $.i18n(formatLabelKey))
    .attr("format", format)
    .addClass("default-importing-parsing-control-panel-format")
    .appendTo(self._parsingPanelElmts.formatsContainer)
    .on('click',function() {
      self._selectFormat(format);
    });

    if (format == self._format) {
      tab.addClass("selected");
    }
  };
  for (var i = 0; i < formats.length; i++) {
    createFormatTab(formats[i]);
  }
  this._selectFormat(this._format);
};

Refine.SPARQLImportingController.prototype._disposeParserUI = function() {
  if (this._formatParserUI) {
    this._formatParserUI.dispose();
    delete this._formatParserUI;
  }
  if (this._parsingPanelElmts) {
    this._parsingPanelElmts.optionsContainer.off().empty();
    this._parsingPanelElmts.progressPanel.off();
    this._parsingPanelElmts.dataPanel.off().empty();
  }
};

Refine.SPARQLImportingController.prototype._selectFormat = function(newFormat) {
  if (newFormat == this._format && (this._formatParserUI)) {
    // The new format is the same as the existing one.
    return;
  }

  var uiClass = Refine.JsonParserUI;
  if (uiClass) {
    var self = this;
    this._ensureFormatParserUIHasInitializationData(newFormat, function() {
      self._disposeParserUI();
      self._parsingPanelElmts.formatsContainer
      .find(".default-importing-parsing-control-panel-format")
      .removeClass("selected")
      .each(function() {
        if (this.getAttribute("format") == newFormat) {
          $(this).addClass("selected");
        }
      });

      self._format = newFormat;
      self._formatParserUI = new uiClass(
        self,
        self._jobID,
        self._job,
        self._format,
        self._parserOptions[newFormat],
        self._parsingPanelElmts.dataPanel,
        self._parsingPanelElmts.progressPanel,
        self._parsingPanelElmts.optionsContainer
      );
    });
  }
};

Refine.SPARQLImportingController.prototype._ensureFormatParserUIHasInitializationData = function(format, onDone) {
  if (!(format in this._parserOptions)) {
    var self = this;
    var dismissBusy = DialogSystem.showBusy($.i18n('core-index-import/inspecting'));
    Refine.wrapCSRF(function(token) {
        $.post(
        "command/core/importing-controller?" + $.param({
            "controller": "core/default-importing-controller",
            "jobID": self._jobID,
            "subCommand": "initialize-parser-ui",
            "format": format,
            "csrf_token": token
        }),
        null,
        function(data) {
            dismissBusy();

            if (data.options) {
            self._parserOptions[format] = data.options;
            onDone();
            }
        },
        "json"
        )
        .fail(function() {
            dismissBusy();
            alert($.i18n('core-views/check-format'));
        });
    });
  } else {
    onDone();
  }
};

Refine.SPARQLImportingController.prototype.updateFormatAndOptions = function(options, callback, finallyCallBack) {
  var self = this;
  Refine.wrapCSRF(function(token) {
    $.post(
      "command/core/importing-controller?" + $.param({
        "controller": "core/default-importing-controller",
        "jobID": self._jobID,
        "subCommand": "update-format-and-options",
        "csrf_token": token
      }),
      {
        "format" : self._format,
        "options" : JSON.stringify(options)
      },
      function(o) {
        if (o.status == 'error') {
          if (o.message) {
            alert(o.message);
          } else {
            var messages = [];
            $.each(o.errors, function() { messages.push(this.message); });
            alert(messages.join('\n\n'));
            }
            if(finallyCallBack){
              finallyCallBack();
            }
          }
          callback(o);
        },
        "json"
    ).fail(() => { alert($.i18n('core-index-parser/update-format-failed')); });
  });
};

Refine.DefaultImportingController.prototype.updateFormatAndOptions = function(options, callback, finallyCallBack) {
  var self = this;
  Refine.wrapCSRF(function(token) {
    $.post(
      "command/core/importing-controller?" + $.param({
        "controller": "core/default-importing-controller",
        "jobID": self._jobID,
        "subCommand": "update-format-and-options",
        "csrf_token": token
      }),
      {
        "format" : self._format,
        "options" : JSON.stringify(options)
      },
      function(o) {
        if (o.status == 'error') {
          if (o.message) {
            alert(o.message);
          } else {
            var messages = [];
            $.each(o.errors, function() { messages.push(this.message); });
            alert(messages.join('\n\n'));
            }
            if(finallyCallBack){
              finallyCallBack();
            }
          }
          callback(o);
        },
        "json"
    ).fail(() => { alert($.i18n('core-index-parser/update-format-failed')); });
  });
};

Refine.DefaultImportingController.prototype.getPreviewData = function(callback, numRows) {
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

