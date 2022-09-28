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

var columnNames = [];
var reconServices = [];
var schemaSpaces = [];
var identifierSpaces = [];

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
    columnNames: columnNames ,
    reconServices:reconServices,
    schemaSpaces:schemaSpaces,
    identifierSpaces:identifierSpaces,
  };

  return options;
};

Refine.SPARQLImportingController.prototype._showParsingPanel = function() {
  var self = this;
  
  this._parsingPanel.off().empty().html(
      DOM.loadHTML("sparql", "scripts/views/sparql-parsing-panel.html"));
      
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

      elmts.dataPanel
      .css("left", "0px")
      .css("top", headerHeight + "px")
      .css("width", (width - DOM.getHPaddings(elmts.dataPanel)) + "px")
      .css("height", (height - headerHeight - DOM.getVPaddings(elmts.dataPanel)) + "px");
      elmts.progressPanel
      .css("left", "0px")
      .css("top", headerHeight + "px")
      .css("width", (width - DOM.getHPaddings(elmts.progressPanel)) + "px")
      .css("height", (height - headerHeight - DOM.getVPaddings(elmts.progressPanel)) + "px");
      
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
    this._createProjectUI.showCustomPanel(this._parsingPanel);
    this._updatePreview();
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

                new Refine.SparqlPreviewTable(projectData, self._parsingPanelElmts.dataPanel.off().empty());
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

Refine.SparqlPreviewTable = function(projectData, elmt) {
  this._projectData = projectData;
  this._elmt = elmt;
  this._render();
};

Refine.SparqlPreviewTable.prototype._render = function() {
  var self = this;
  var table = $('<table>').addClass("data-table").appendTo(this._elmt)[0];

  var columns = this._projectData.columnModel.columns;

  /*------------------------------------------------------------
   *  Column Headers
   *------------------------------------------------------------
   */

  var trHead = table.insertRow(table.rows.length);
  
  DOM.bind(
      $(trHead.appendChild(document.createElement("th")))
      .attr("colspan", "1")
      .addClass("column-header")
      .html(
        '<div class="column-header-title">' +
          '<a class="column-header-title" ></a><span class="column-header-name">'+'&nbsp'+'</span>' +
        '</div>'
      )
  );
  this._columnHeaderUIs = [];
  var createColumnHeader = function(column, index) {
    var th = trHead.appendChild(document.createElement("th"));
    $(th).addClass("column-header").attr('title', column.name);

      var columnHeaderUI = new SparqlDataTableColumnHeaderUI(column, index, th);
      self._columnHeaderUIs.push(columnHeaderUI);

  };
  
  for (var i = 0; i < columns.length; i++) {
    createColumnHeader(columns[i], i);
  }

  /*------------------------------------------------------------
   *  Data Cells
   *------------------------------------------------------------
   */

  var rows = this._projectData.rowModel.rows;
  var renderRow = function(tr, r, row, even) {
    $(tr).addClass(even ? "even" : "odd");

    var cells = row.cells;
    var tdIndex = tr.insertCell(tr.cells.length);
    $('<div></div>').html((row.i + 1) + ".").appendTo(tdIndex);

    for (var i = 0; i < columns.length; i++) {
      var column = columns[i];
      var td = tr.insertCell(tr.cells.length);
      var divContent = $('<div/>').addClass("data-table-cell-content").appendTo(td);

      var cell = (column.cellIndex < cells.length) ? cells[column.cellIndex] : null;
      if (!cell || ("v" in cell && cell.v === null)) {
        $('<span>').html("&nbsp;").appendTo(divContent);
      } else if ("e" in cell) {
        $('<span>').addClass("data-table-error").text(cell.e).appendTo(divContent);
      } else {
        if ("r" in cell && cell.ri !== null) {
          $('<a>')
          .attr("href", "#") // we don't have access to the reconciliation data here
          .text(cell.v)
          .appendTo(divContent);
        } else if (typeof cell.v !== "string") {
          if (typeof cell.v == "number") {
            divContent.addClass("data-table-cell-content-numeric");
          }
          $('<span>')
          .addClass("data-table-value-nonstring")
          .text(cell.v)
          .appendTo(divContent);
        } else if (URL.looksLikeUrl(cell.v)) {
          $('<a>')
          .text(cell.v)
          .attr("href", cell.v)
          .attr("target", "_blank")
          .appendTo(divContent);
        } else {
          $('<span>').text(cell.v).appendTo(divContent);
        }
      }
    }
  };

  var even = true;
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var tr = table.insertRow(table.rows.length);
    even = !even;
    renderRow(tr, r, row, even);
  }    
};

SparqlDataTableColumnHeaderUI= function(column, columnIndex, td) {
  this._column = column;
  this._columnIndex = columnIndex;
  this._td = td;

  this._render();
};

SparqlDataTableColumnHeaderUI.prototype.getColumn = function() {
  return this._column;
};

SparqlDataTableColumnHeaderUI.prototype._render = function() {
  var self = this;
  var td = $(this._td);

  td.html(DOM.loadHTML("sparql", "scripts/views/column-header.html"));
  var elmts = DOM.bind(td);

  elmts.nameContainer.text(this._column.name);
  
  elmts.dropdownMenu.on('click',function() {
    var frame = DialogSystem.createDialog();
    frame.width("400px");
    
    var header = $('<div></div>').addClass("dialog-header").text($.i18n('sparql-views/use-values-as-identifiers/header')).appendTo(frame)
    var body = $('<div></div>').addClass("dialog-body").appendTo(frame);
    var footer = $('<div></div>').addClass("dialog-footer").appendTo(frame);
    
    $('<p></p>').text($.i18n('sparql-views/choose-reconciliation-service')).appendTo(body);
    var select = $('<select></select>').appendTo(body);
    var services = ReconciliationManager.getAllServices();
    for (var i = 0; i < services.length; i++) {
        var service = services[i];
        $('<option></option>').val(service.url)
           .text(service.name)
           .appendTo(select);
    }
           
    $('<button class="button"></button>').text($.i18n('sparql-buttons/cancel')).on('click',function() {
      DialogSystem.dismissUntil(level - 1);
    }).appendTo(footer);
        $('<button class="button"></button>').html($.i18n('sparql-buttons/ok')).on('click',function() {
        
        var reconService = select.val();
        var identifierSpace = null;
        var schemaSpace = null;
        for(var i = 0; i < services.length; i++) {
           if(services[i].url === reconService) {
              identifierSpace = services[i].identifierSpace;
              schemaSpace = services[i].schemaSpace;
           }
        }
        if (identifierSpace === null) {
            alert($.i18n('sparql-views/choose-reconciliation-service-alert'));
		} else {
			if (!columnNames.includes(self.getColumn().name)) {
				columnNames.push(self.getColumn().name);
				reconServices.push(reconService);
				schemaSpaces.push(schemaSpace);
				identifierSpaces.push(identifierSpace);

			} else {
				alert($.i18n('sparql-views/reconciliation-service-already-chosen-alert'));
			}
          
           
       }
       DialogSystem.dismissUntil(level - 1);
    }).appendTo(footer);
   
    var level = DialogSystem.showDialog(frame);
  });
};
