({
	doInit : function(component, event, helper) {
		helper.showSpinner(component, event);           
        
		component.set("v.einsteinKey", helper.getDefaultKey());
		component.set("v.json", helper.getDefaultJSON());   

        var action = component.get("c.getToken");  
        action.setCallback(this, function(a){
            component.set("v.einsteinToken", a.getReturnValue());
	        helper.refresh(component, event);            
        });     
        $A.enqueueAction(action);            

	},
	refresh : function(component, event, helper) {
	    helper.refresh(component, event);
    }, 
	upload : function(component, event, helper) {
		var einsteinToken = component.get("v.einsteinToken");
        var json = component.get("v.json");
        var data = {'type': 'text-intent', 'data': json};
        $.ajax({
            url: "https://df17demo.herokuapp.com/" + "https://api.einstein.ai/v2/language/datasets/upload",
            type: "POST",
            headers: {"Authorization": "Bearer " + einsteinToken},
            data: data,       
            success: function(data) {
                console.log('upload data', data);
            },
            error: function (xhr, textStatus, errorThrown) {
				console.log('error', xhr, textStatus, errorThrown);
            }            
        });                  
        helper.refresh(component, event);
    },
    handleSetToken : function(component, event, helper) {
        var action = component.get("c.setToken");  
        action.setParams({ token : component.get("v.einsteinToken") });        
        action.setCallback(this, function(a){
            console.log('handleSetToken');
        });     
        $A.enqueueAction(action);    
    },
    doQuery : function(component, event, helper) {
        var action = component.get("c.query");   
        action.setCallback(this, function(a){
            var retVal = a.getReturnValue();
            console.log('query retVal', retVal);
            
            component.set("v.queryData", retVal);             
            
            //group by product
            var prodMap = {};
            
            for (var i=0; i<retVal.length; i++) {
                var r = retVal[i];
                if (!(r.Product__r.Name in prodMap)) {
                	prodMap[r.Product__r.Name] = [];
                }
				prodMap[r.Product__r.Name].push(r);
            } 
            console.log('prodMap', prodMap);	 
            
            //build an indexed array of objs with 2 properties: prod name and count of SOLs
            var prodCount = [];
            for (var pname in prodMap) {
                prodCount.push({name: pname, count: prodMap[pname].length});   
            }
            //sort the array
            prodCount.sort(function(a, b) {
                if (a.count > b.count) {return 1;}    
                if (a.count < b.count) {return -1;}
                return 0;
            });        
            
            //collapse it down to just a string array
            var arrCount = [];
            for (i=0; i<prodCount.length; i++) {
                var p = prodCount[i];
                arrCount.push(p.count+',' +p.name);
            }
            
            console.log('arrCount', JSON.stringify(arrCount));
            
        });     
        $A.enqueueAction(action);
    },     
    
	prepData : function(component, event, helper) {
        
        var labels = [
            "Feather Flag - Small - Double Sided - Same Art (Dye Sub)",
            "10x20 mightyTENT Transit Bag",
            "8' Table Cover (Dye Sub)",
            "10' x 20' Peak Banner Hardware",
            "mightyTent Stake Kit - 6 stakes",
            "Dome Window",
            "Single Zipper",
            "COS- Duffle Bag",
            "66lb Footplates",
            "mightyTent Stake Kit - 4 stakes"
        ];        
        
        var data = component.get("v.queryData");         
		
        
        //build a distinct list of all products
        var allProds = [];
        for (var i=0; i<data.length; i++) {        
            var p = data[i].Product__r.Name;
            if (allProds.indexOf(p) == -1) {
            	allProds.push(p);   
            }
        }
        //labels = allProds;
        
        //initialize an object for Einstein training
        var md = {"intents":{}};
        for (var i=0; i<labels.length; i++) {
            md.intents[labels[i]] = [];
        } 
        console.log('md init', md);
        
        //now loop through the raw data and group on the SO id
        var soMap = {};
        
        for (var i=0; i<data.length; i++) {
            var r = data[i];
            if (!(r.Sales_Order__c in soMap)) {
                soMap[r.Sales_Order__c] = [];
            }
            
            soMap[r.Sales_Order__c].push(r);
        }         
        console.log('soMap', soMap);
        
        //loop through the labels
        for (var label in md.intents) {
            for (var so in soMap) {
                var prodInSO = false;
                var arrInput = [];
                for (var i=0; i<soMap[so].length; i++) {
                    if (label == soMap[so][i].Product__r.Name) {
                        prodInSO = true;
                    } else {
                        arrInput.push(soMap[so][i].Product__r.Name);
                    }
                }  
                //if we found this label in the products on the SO, add all the input
                if (prodInSO) {
                    if (arrInput.length > 0) {
                        var sInput = arrInput.join(" ");
                        md.intents[label].push(sInput);                        
                    }
                }
            }
        }
         console.log('md1', md);
        //now loop through the intents object and delete any keys which have fewer than 5 values
        for (var label in md.intents) {
            
            //dedupe
            var uniqueVals = [];
            $.each(md.intents[label], function(i, el){
                if($.inArray(el, uniqueVals) === -1) uniqueVals.push(el);
            });            
            md.intents[label] = uniqueVals; 
            
            if (md.intents[label].length < 5) {
            	delete md.intents[label];   
            }
        }
        
        console.log('md3', md);
        component.set("v.json", JSON.stringify(md));  
    },      
	createModel : function(component, event, helper) {
		helper.showSpinner(component, event);
        
		var einsteinToken = component.get("v.einsteinToken");
		var datasetId = event.getSource().get("v.name");     
		var modelName = 'model'+datasetId;
        
        var data = {'datasetId': datasetId, 'name': modelName};
        $.ajax({
            url: "https://df17demo.herokuapp.com/" + "https://api.einstein.ai/v2/language/train",
            type: "POST",
            headers: {"Authorization": "Bearer " + einsteinToken},
            data: data,       
            success: function(data) {
                console.log('createModel data', data);
            },
            error: function (xhr, textStatus, errorThrown) {
				console.log('error', xhr, textStatus, errorThrown);
            }            
        });                
        helper.refresh(component, event);
    }, 
	graph : function(component, event, helper) {
		var einsteinToken = component.get("v.einsteinToken");
		var modelId = event.getSource().get("v.name");        

         $.ajax({
             url: "https://df17demo.herokuapp.com/" + "https://api.einstein.ai/v2/language/models/"+modelId+"/lc",
             type: "GET",
             headers: {"Cache-Control": "no-cache", "Authorization": "Bearer " + einsteinToken},
             success: function(response) {
                 //console.log('graph response', response);
                 var learningCurve = JSON.parse(response);
                 console.log('learningCurve', learningCurve);

                 var testAccuracy = [];
                 for (var i=0; i<learningCurve.data.length; i++) {
                     var acc = learningCurve.data[i].metricsData.testAccuracy;
                     acc = (acc*100).toFixed(2);
                     testAccuracy.push(acc);
                 }
                 var dataSeries = testAccuracy.join(',');
                 
                 var graphURL = 'https://chart.googleapis.com/chart?cht=ls&chs=700x300&chd=t:'+dataSeries;
                 component.set("v.displayChart", true);   
                 $("#learningCurve").attr('src', graphURL);   
             },
             error: function (xhr, textStatus, errorThrown) {
                 console.log('error', xhr, textStatus, errorThrown);
                 h.hideSpinner(component, event);  
             }            
         });     
    },    
	retrain : function(component, event, helper) {
		helper.showSpinner(component, event);
		var einsteinToken = component.get("v.einsteinToken");
		var modelId = event.getSource().get("v.name");        
        
        var data = {'modelId': modelId};
        $.ajax({
            url: "https://df17demo.herokuapp.com/" + "https://api.einstein.ai/v2/language/retrain",
            type: "POST",
            headers: {"Authorization": "Bearer " + einsteinToken},
            data: data,       
            success: function(data) {
                console.log('retrain data', data);
            },
            error: function (xhr, textStatus, errorThrown) {
				console.log('error', xhr, textStatus, errorThrown);
            }            
        });   
        helper.refresh(component, event);
    },
    predict : function(component, event, helper) {
		//clear the prev prediction and show the modal
        var modelId = event.getSource().get("v.name");
        console.log('predict modelId: ' + modelId);
        
        component.set("v.predictionResults", "");                  
        component.set("v.displayPredict", true);            
        component.set("v.modelId", modelId);                  
    },    
    closeModal : function(component, event, helper) {
		//clear the prev prediction and close the modal
        component.set("v.predictionResults", "");                  
        component.set("v.displayPredict", false);  
		component.set("v.modelId", "");           
        component.set("v.displayChart", false);              
    },    
    doPredict : function(component, event, helper) {
		var einsteinToken = component.get("v.einsteinToken");
        var modelId = component.get("v.modelId")+'';
        console.log('modelId: ' + modelId);               

        var predictVal = component.find("predictText").get("v.value");
        console.log('predictVal: ' + predictVal);
        
        var data = {'document': predictVal, 'modelId': modelId};
        $.ajax({
            url: "https://df17demo.herokuapp.com/" + "https://api.einstein.ai/v2/language/intent",
            type: "POST",
            headers: {"Authorization": "Bearer " + einsteinToken},
            data: data,       
            success: function(data) {
                console.log("doPrediction data", data);
                component.set("v.predictionResults", data);                         
            },
            error: function (xhr, textStatus, errorThrown) {
				console.log('error', xhr, textStatus, errorThrown);
            }            
        });       
    },   
    deleteDataset : function(component, event, helper) {
        var einsteinToken = component.get("v.einsteinToken");
        var datasetId = event.getSource().get("v.name");
        
        $.ajax({
            url: "https://df17demo.herokuapp.com/" + "https://api.einstein.ai/v2/language/datasets/"+datasetId,
            type: "DELETE",
            headers: {"Cache-Control": "no-cache", "Authorization": "Bearer " + einsteinToken},
            success: function(data) {
                console.log('deleteDataset data', data);
            }
        });                    
        
        component.set("v.datasets", []);  
        helper.refresh(component, event);        
    }    

})