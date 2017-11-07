var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({
	extended: false,
	limit: '2000mb'
}));

var https = require('https');

//some global objects to hold the data for our custom "datasetsDetail" API method
//the composes multiple Einstein API calls into one response
var datasets = [];
var modelsByDatasetObj = {};
var modelMetricsObj = {};
var trainingObj = {};



// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Cache-Control,Authorization,Connection,Content-Length');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});


app.get('/*', function(request, response) {
	console.log('app.get');
	var prep = prepRequest(request, response, 'GET');
	var options = prep.options;

	console.log('app.get options' + JSON.stringify(options));

	if (options.host == 'datasetsDetail') {
		//special case custom proxy method
		datasetsDetail(request, response, options);
	} else if (options.host == 'labels') {
		//special case custom proxy method
		getLabels(request, response, options);
	} else {
		//proxy any other get requests
		var sData = '';
		https.get(options, function(res) {
			res.on("data", function(chunk) {
				sData += chunk;
			});
			res.on('end', function() {
				//todo get the content-Type from the request header
				response.writeHead(res.statusCode, {'Content-Type': 'application/text'});
				response.end(sData);		
			});
		}).on('error', function(e) {
			response.writeHead(500, {'Content-Type': 'application/text'});		
			response.end('error');
		});	
	}
});	

app.post('/*', function(request, response) {
	console.log('app.post');
	var prep = prepRequest(request, response, 'POST');	
	var options = prep.options;
	options.method = 'POST';
	options.headers.Connection = "keep-alive";

	console.log('app.post options' + JSON.stringify(options));
	console.log('app.post request.body', request.body);
	//console.log('app.post request.body stringify', JSON.stringify(request.body));	

	
	var boundaryKey = Math.random().toString(16); //random string
	var end = Buffer.from('\r\n--' + boundaryKey + '--\r\n');

	var sBodyArr = [];

	//build a multipart form out of the acceptable params passed in
	var acceptedBodyParams = ['type', 'data', 'name', 'datasetId', 'modelId', 'document', 'expectedLabel'];
	for (var key in request.body) {
		for (var i=0; i<acceptedBodyParams.length; i++) {
			var a = acceptedBodyParams[i];
			if (key.toUpperCase() ==  a.toUpperCase()) {
				var value = request.body[key];
				var formVal;
				if (a == 'data') {
					formVal = buildFilePart(boundaryKey, value);
				} else {
					formVal = buildFieldPart(boundaryKey, a, value);
				}
				sBodyArr.push(formVal);
			}
		}
	}
	var end = '\r\n--' + boundaryKey + '--\r\n';
	sBodyArr.push(end);
	console.log('sBodyArr', sBodyArr);

	bBodyArr = [];
	for (var i=0; i<sBodyArr.length; i++) {
		bBodyArr.push(Buffer.from(sBodyArr[i]));
	}

	var bBody = Buffer.concat(bBodyArr);

	console.log('bBody.byteLength: ' + bBody.byteLength);

	options.headers['Content-Type'] = 'multipart/form-data; boundary="'+boundaryKey+'"';
	options.headers['Content-Length'] = bBody.byteLength;

	var sData = '';
	var req = https.request(options, function(res) {
		res.on("data", function(chunk) {
			sData += chunk;
			//console.log(chunk);
		});

		res.on('end', function() {
			response.writeHead(res.statusCode, {'Content-Type': 'application/text'});
			response.end(sData);	
			console.log('res.statusCode', res.statusCode);
			console.log('sData', sData);
		});
	});

	req.on('error', function(e) {
		response.writeHead(500, {'Content-Type': 'application/text'});		
		response.end('error');
	});

	req.write(bBody);
	req.end();
});	

function buildFieldPart(boundaryKey, name, value) {
	var formField =
	'--' + boundaryKey + '\r\n' +
	'Content-Disposition: form-data; name="'+name+'"\r\n\r\n' +
	value + '\r\n';
	return formField;
}

function buildFilePart(boundaryKey, file) {
	var formFile =
	'--' + boundaryKey + '\r\n' +
	'Content-Disposition: form-data; name="data"; filename="json.json"\r\n' +
	'Content-Type: application/json\r\n\r\n' + file;
	return formFile;
}


app.delete('/*', function(request, response) {
	console.log('app.delete');
	var prep = prepRequest(request, response, 'DELETE');	
	var options = prep.options;
	options.method = 'DELETE';

	console.log('app.delete options' + JSON.stringify(options));

	var sData = '';
	var req = https.request(options, function(res) {
		res.on("data", function(chunk) {
			sData += chunk;
			//console.log(chunk);
		});

		res.on('end', function() {
			response.writeHead(res.statusCode, {'Content-Type': 'application/text'});
			response.end(sData);	
		});
	});

	req.on('error', function(e) {
		response.writeHead(500, {'Content-Type': 'application/text'});		
		response.end('error');
	});

	req.end();
});	


function getLabels(request, response, options) {
	console.log('*** getLabels ***');
	console.log('options', options);

	var authHeaderVal = options.headers.Authorization;

	var modelId = options.path.replace("/", "");


	//start by getting the datasets
	var options = {
		host: 'api.einstein.ai',
		path: '/v2/language/models/'+modelId,
		headers: {"Cache-Control": "no-cache", "Authorization": authHeaderVal}
	};



	var modelMetricsCallback = function(error, result) {
		//set the global

		console.log('modelMetricsCallback result', result);

		var labels = [];
		try {
			var modelMetrics = JSON.parse(result);
			labels = modelMetrics.metricsData.labels;
		} catch(e) {
			labels = [];
		}

		response.writeHead(200, {'Content-Type': 'application/text'});
		response.end(JSON.stringify(labels));			
	};

	doGet(options, modelMetricsCallback);	

}



function datasetsDetail(request, response, options) {
	console.log('*** datasetsDetail ***');

	var authHeaderVal = options.headers.Authorization;

	//start by getting the datasets
	var options = {
		host: 'api.einstein.ai',
		path: '/v2/language/datasets',
		headers: {"Cache-Control": "no-cache", "Authorization": authHeaderVal}
	};

	var datasetsCallback = function(error, result) {
		//set the global
		datasets = (JSON.parse(result)).data;

		var detailsCallback = function() {
			assembleDatasetModelData(request, response);
		};
		getDatasetDetails(authHeaderVal, detailsCallback);
	};

	doGet(options, datasetsCallback);	
}

function assembleDatasetModelData(request, response) {
	
	for (var i=0; i<datasets.length; i++) {
	    var dataset = datasets[i];

	    //join the base model data into the dataset
	    if (dataset.id in modelsByDatasetObj) {
			dataset.models = modelsByDatasetObj[dataset.id];

			for (var j=0; j<dataset.models.length; j++) {
				var model = dataset.models[j];

				//join the training data into the model data
				model.trainingStatus = trainingObj[model.modelId];

				//join the metrics data into the model data
				if (model.modelId in modelMetricsObj) {
					//transform the data a bit so it's easier to display
                    var labelMetrics = [];
                    var metricsData = modelMetricsObj[model.modelId];
                    for (var lm=0; lm<metricsData.labels.length; lm++) {
                        labelMetrics.push({
                            'label': metricsData.labels[lm],
                            'f1': metricsData.f1[lm],
                            'confusionMatrix': JSON.stringify(metricsData.confusionMatrix[lm])
                        });	    
                    }
                    
                    model.metricsData = {
                        'labelMetrics': labelMetrics,
                        'testAccuracy': metricsData.testAccuracy,
                        'trainingAccuracy': metricsData.trainingAccuracy,
                        'trainingLoss': metricsData.trainingLoss
                    };
				}
			}
	    }
	}

	//console.log('datasets compelete', datasets);

	response.writeHead(200, {'Content-Type': 'application/text'});
	response.end(JSON.stringify(datasets));		
}

function getDatasetDetails(authHeaderVal, detailCallback) {

	console.log('*** getDatasetDetails');
    
	//keep track of how many models we have and how many we've received data for
	var totalModelsByDataset = {};
	var modelTrainingReceivedByDataset = {};	
	var modelMetricsReceivedByDataset = {};	

    //loop through and get the models for each dataset
    //console.log('getDatasetDetails datasets', datasets);

    //init some objects
    for (var i=0; i<datasets.length; i++) {
        var dataset = datasets[i];
        totalModelsByDataset[dataset.id] = 0;
		modelTrainingReceivedByDataset[dataset.id] = 0;
		modelMetricsReceivedByDataset[dataset.id] = 0;
   	}

    //for each dataset, get all the models.  For each model get the training info and model metrics
    for (var i=0; i<datasets.length; i++) {
        var dataset = datasets[i];

		var mOptions = {
			host: 'api.einstein.ai',
			path: '/v2/language/datasets/'+dataset.id+'/models',
			headers: {"Cache-Control": "no-cache", "Authorization": authHeaderVal}
		};


		var context = {'datasetId': dataset.id};

		var mCallback = function(maError, maRetVal) {
			//all the models for some dataset

			var context = this;

			//parse the model response and join it into the data set response
            var models = JSON.parse(maRetVal).data;
            //console.log('models', models);
			
            if (models == null) {
            	models = [];	
            }

            totalModelsByDataset[context.datasetId] = models.length;

			var modelToDatasetMap = {};

            if (models.length == 0) {
            	//short circuit
            	checkIfDone(totalModelsByDataset, modelTrainingReceivedByDataset, modelMetricsReceivedByDataset, detailCallback);
           	} else {
                var datasetId = models[0].datasetId;
                
               	//add to the global object
               	modelsByDatasetObj[datasetId] = models;

                for (var m=0; m<models.length; m++) {
                	var model = models[m];

					modelToDatasetMap[model.modelId] = datasetId;

                    //====== BEGIN get the training info
					var tOptions = {
						host: 'api.einstein.ai',
						path: '/v2/language/train/'+model.modelId,
						headers: {"Cache-Control": "no-cache", "Authorization": authHeaderVal}
					};                    

					var trainingCallback = function(tError, trainingRetVal) {
                        var training = JSON.parse(trainingRetVal);
                        //console.log('training', training);                                                     
                        
                        //add to the global object
						trainingObj[training.modelId] = training;

						var dId = training.datasetId;
						modelTrainingReceivedByDataset[dId]++;

						checkIfDone(totalModelsByDataset, modelTrainingReceivedByDataset, modelMetricsReceivedByDataset, detailCallback);
					};
					doGet(tOptions, trainingCallback);	
					//====== END get the training info


 					//====== BEGIN get the model metrics
 					if (model.status == "SUCCEEDED") {
						var metOptions = {
							host: 'api.einstein.ai',
							path: '/v2/language/models/'+model.modelId,
							headers: {"Cache-Control": "no-cache", "Authorization": authHeaderVal}
						};   

						var metCallback = function(metError, metResult) {
                            var metrics = JSON.parse(metResult);
							//console.log('metrics', metrics);                                                       
	                        
	                        //add to the global object
							modelMetricsObj[metrics.id] = metrics.metricsData;

							//get the dataset this model belongs to since it isn't in the repsonse
							var dId = modelToDatasetMap[metrics.id];
							modelMetricsReceivedByDataset[dId]++;

							checkIfDone(totalModelsByDataset, modelTrainingReceivedByDataset, modelMetricsReceivedByDataset, detailCallback);
						};
						doGet(metOptions, metCallback);	
 					} else {
						//non-SUCCEEDED models don't have metrics, so just short circuit it
						modelMetricsReceivedByDataset[datasetId]++; 
						
						checkIfDone(totalModelsByDataset, modelTrainingReceivedByDataset, modelMetricsReceivedByDataset, detailCallback);
 					}
 					//====== END get the model metrics

                }
            }

		};        
		var mCallbackWithContext = mCallback.bind(context);    
		doGet(mOptions, mCallbackWithContext);
    }

}


function checkIfDone(totalModelsByDataset, modelTrainingReceivedByDataset, modelMetricsReceivedByDataset, detailCallback) {
	//see if everything has been received, if so, call the callback

	console.log('*** checkIfDone: totalModelsByDataset', totalModelsByDataset);
	console.log('*** checkIfDone: modelTrainingReceivedByDataset', modelTrainingReceivedByDataset);
	console.log('*** checkIfDone: modelMetricsReceivedByDataset', modelMetricsReceivedByDataset);



	var hasAll = true;
	for (var key in totalModelsByDataset) {
		var total = totalModelsByDataset[key];

		if ( (modelTrainingReceivedByDataset[key] != total) ||
		 	 (modelMetricsReceivedByDataset[key] != total) ) {
			hasAll = false;
			break;
		}
	}

	if (hasAll) {
		detailCallback();	
	}

}



function doGet(options, callback) {
	var sData = '';
	https.get(options, function(res) {
		res.on("data", function(chunk) {
			sData += chunk;
		});
		res.on('end', function() {
			callback(false, sData);
		});
	}).on('error', function(e) {
		console.log('doGet ERROR: ', e);
		callback(true, null);
	});		
}

function prepRequest(request, response, method) {

	console.log('req.originalUrl: ' + request.originalUrl);
	console.log('req.path: ' + request.path);
	var path = request.originalUrl.substr(1);
	console.log('request.path: ' + path);	

	var host = path.replace('https://', '').replace('http://', '');
	// www.google.com/subdir?sdfsdf=312434
	var arrURL = host.split('/');
	host = arrURL[0]+'';

	var path = '';
	if (arrURL.length > 1) {
		arrURL.shift(); //remove the host portion of the array	
		path = arrURL.join('/');
	}
	path = '/'+path;

	var headerObj = {};

	//build a filtered version of the headers passed in
	var acceptedHeaders = ['Authorization', 'Cache-Control', 'Connection', 'Content-Length', 'Content-Type'];
	for (var key in request.headers) {
		for (var i=0; i<acceptedHeaders.length; i++) {
			var a = acceptedHeaders[i];
			if (key.toUpperCase() ==  a.toUpperCase()) {
				headerObj[a] = request.headers[key];
			}
		}
	}

	console.log('HEADERS', JSON.stringify(headerObj));

	var options = {
		host: host,
		path: path,
		headers: headerObj
	};

	return {"options": options};
}


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
