var endpoint;
Refine.SPARQLSourceUI = function(controller) {
  this._controller = controller;
  
};

Refine.SPARQLSourceUI.prototype.attachUI = function(body) {
  var self = this;
  this._body = body;
  
  this._body.html(DOM.loadHTML("sparql", "scripts/index/import-from-sparql-form.html"));
  this._elmts = DOM.bind(this._body);
  
  $('#sparql-endpoint').text($.i18n('sparql-import/endpoint-label'));
  $('#or-import-sparql').text($.i18n('sparql-import/importer-label'));
  this._elmts.queryButton.html($.i18n('sparql-buttons/query'));
  this._elmts.endpointTextInput[0].defaultValue = "https://query.wikidata.org/bigdata/namespace/wdq/sparql";
  
  this._elmts.queryButton.on('click',function(evt){
    
    var endpoint = jQuery.trim($( "#sparql-endpoint-textarea" ).val());
    
    var api = new wikibase.queryService.api.Sparql(endpoint);
    
    var query = jQuery.trim($( "#sparql-query-textarea" ).val());
    
    api.query( query ).done(function(){
      var json = JSON.parse( api.getResultAsJson() );
      $("#sparql-query-textarea").val('');
      $("#sparql-query-textarea").val(JSON.stringify(json));
        
      self._controller.startImportJob(self._elmts.form, $.i18n('core-index-import/uploading-pasted-data'))
    }).fail(function(){
	  alert(api._error.message);
    });
  });
};

Refine.SPARQLSourceUI.prototype.focus = function() {
};
