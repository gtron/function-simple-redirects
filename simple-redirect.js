'esversion:6';

/**
 * 
 */

const http = require('http');
const querystring = require('querystring');

var urlProcessor = ({
  context:"", req:"", res:"",
  key: "", urlData: "", call : 0,
  
  processData : function(data) {
    this.urlData = data;
    this.checkData();
    this.incLocalCounter();
    this.saveData(this.key,this.urlData);
    
    influxDb.send({"urlKey": this.key});
    
    this.sendRedirect(302, this.urlData.url );
  },
  init : function(ctx, req, res){
    this.context = ctx; this.req = req; this.res = res;
  },
  
  processUrl : function ( url ) {
    let arr = url.split('/');
    let key = arr[arr.length - 1].split('?')[0];
    
    this.key = key;
    
    this.context.storage.get(function (error, data) {
      if (error) 
        return cb(error);
      data = data || { counter: 1 };
      if ( key in data ) {
        urlProcessor.processData(data[key]);
      }  else {
        urlProcessor.sendNotFound();
      }
    });
  },
  
  saveData : function ( k, v ) {
     storage = this.context.storage;
     storage.get(function (error, data) {
          if (error) return cb(error);
          
          data[k] = v;
          storage.set(data, function (error) {
              if (error) return cb(error);
          });
    });
  },
  
  sendNotFound: function (message = 'Not found') {
    this.res.writeHead(404, { 'Content-Type': 'text/html ' });
    this.res.end('Error! ' + message );
  },
  
  sendRedirect : function (code = 404, destination = '') {
    this.res.writeHead(code, { 'Content-Type': 'text/html ', 'Location' : destination });
    this.res.end('<a href="'+destination+'">Continue &raquo;</a>');
  },
   
   checkData : function() {
     if ( this.urlData === undefined )
        throw( new Error('No data')); 
   },
   
   incLocalCounter : function () {
     this.urlData.cnt ++;
   },
   
   log : function (prefix = '---') {
     //console.log("urlProcessorLogger - " + prefix + " call:" + this.call++ , this.urlData );
   }
}); 

module.exports = function (ctx, req, res) {
  influxDb.init(ctx);
  
  urlProcessor.init(ctx, req, res); 
  urlProcessor.processUrl(req.url);
};



/*
  InfludDB Support
*/
var influxDb = ({
  secrets:"",  db:"",  options:"", req:"",
  
  init : function (context) {
    let secrets = context.secrets;
    this.db = secrets.influxDb;
    
    this.options = {
      hostname: secrets.influxHost,
      port: secrets.influxPort,
      path: '/write?db='+secrets.influxDb,
      method: 'POST',
      auth: secrets.influxUser+':'+secrets.influxPassword
    };
  },
  
  send : function (data, value = 1) {
    let postData =  this.db+','+querystring.stringify(data,',') + " value=" + value;
       
    this.options.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
    };
    
    this.req = http.request(this.options, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          console.log(`BODY: ${chunk}`);
        });
    });
      
    this.req.on('error', (e) => {
      console.error(`problem with request to Influx: ${e.message}`);
    });
    
    console.log("sending to InfluxDB: " + postData );
      this.req.write(postData);
      this.req.end();
  }
});
