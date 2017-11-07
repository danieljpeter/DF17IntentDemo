public class PredictCon {
    
    public Id qId {get; set;}
    public List<SBQQ__QuoteLine__c> qls {get; set;}
    public List<SelectOption> modelList {get; set;}
    public String selectedModel {get; set;}
    public String selectedLabel {get; set;}    
    public List<Prediction> predictionList {get; set;}
  	public List<SelectOption> labels {get; set;}
	public String ps {get; set;}
    
    
    public String token {get; set;}
    
    public PredictCon() {
		qId = (Id)ApexPages.currentPage().getParameters().get('id');        
        
        qls = [SELECT Id, SBQQ__ProductName__c 
               FROM SBQQ__QuoteLine__c 
               WHERE SBQQ__Quote__c =: qId
               ORDER BY SBQQ__ProductName__c];
        
        token = '';
        List<Einstein__c> el = [SELECT Token__c FROM Einstein__c WHERE Name='token' LIMIT 1];
        if (el.size() == 1) {
            token = el[0].Token__c;    
        }        
        
        modelList = new List<SelectOption>();
        for (Model__c m: [SELECT Name, ModelId__c FROM Model__c ORDER BY Name]) {
            modelList.add(new SelectOption(m.ModelId__c, m.Name));   
        }
        
		predictionList = new List<Prediction>();
        getLabels();

    }
    
    
    public PageReference getPredictions() {
        predictionList = new List<Prediction>(); 
        
        //build a prediction string from the products
        ps = '';
        for (SBQQ__QuoteLine__c ql: qls) {
        	ps += ' ' + ql.SBQQ__ProductName__c;
        }
        ps = ps.trim();
        
        HttpRequest req = new HttpRequest();
        HttpResponse res = new HttpResponse();
        Http http = new Http();
        system.debug('*** selectedModel: ' + selectedModel);
        
        req.setEndpoint('https://df17demo.herokuapp.com/' + 'https://api.einstein.ai/v2/language/intent');
        req.setMethod('POST');
		req.setHeader('Authorization', 'Bearer ' + token);
        //req.setHeader('Content-Type', 'application/json;charset=UTF-8');
        //req.setBody('{"document": "' + ps + '", "modelId": "' + selectedModel + '"}');
        req.setHeader('Content-Type','application/x-www-form-urlencoded');
        req.setBody('document='+EncodingUtil.urlEncode(ps,'UTF-8')+'&modelId='+EncodingUtil.urlEncode(selectedModel,'UTF-8')); 
        
        res = http.send(req);
        String body = res.getBody();
        System.debug('*** Prediction Response: ' + body);
        Map<String, Object> resObj = (Map<String, Object>)JSON.deserializeUntyped(body);
        List<Object> probObjList = (List<Object>)resObj.get('probabilities');
        for (Object o: probObjList) {
        	Map<String, Object> probMap = (Map<String, Object>)o; 
            
            Prediction p = new Prediction();
            
            p.Label = (String)probMap.get('label');
            p.Probability = (Double)probMap.get('probability');
            p.Selected = false;
            
			predictionList.add(p);         
        }
        
		getLabels();
        
        return null;
    }
    
    
    public void getLabels() {
        HttpRequest req = new HttpRequest();
        HttpResponse res = new HttpResponse();
        Http http = new Http();
        
        req.setEndpoint('https://df17demo.herokuapp.com/labels/'+selectedModel);
        req.setMethod('GET');
		req.setHeader('Authorization', 'Bearer ' + token);
        
        res = http.send(req);
        String body = res.getBody();
        System.debug('*** Prediction Response: ' + body);
        
        List<String> labelList =  (List<String>)JSON.deserialize(body, List<String>.class);
        labels = new List<SelectOption>();
        for (String label: labelList) {
            labels.add(new SelectOption(label, label));   
        }        
    }    
    
    
    public PageReference revise() {
        
        HttpRequest req = new HttpRequest();        
        HttpResponse res = new HttpResponse();
        Http http = new Http();
        
        req.setEndpoint('https://df17demo.herokuapp.com/' + 'https://api.einstein.ai/v2/language/feedback');
        req.setMethod('POST');
		req.setHeader('Authorization', 'Bearer ' + token);
        req.setHeader('Content-Type','application/x-www-form-urlencoded');
        
        req.setBody(
            'modelId='+EncodingUtil.urlEncode(selectedModel,'UTF-8')+
            '&document='+EncodingUtil.urlEncode(ps,'UTF-8')+
            '&expectedLabel='+EncodingUtil.urlEncode(selectedLabel,'UTF-8')
        ); 
        
        res = http.send(req);
        String body = res.getBody();
        System.debug('*** revise Response: ' + body);
        
        return null;
    }    
    
    
    public PageReference addToQuote() {
        List<SBQQ__QuoteLine__c> qlInsertList = new List<SBQQ__QuoteLine__c>();

        //build a map of Product name to Product Id 
        Map<String, Id> productMap = new Map<String, Id>();
        for (Prediction p: predictionList) {
            if (p.Selected) {
				productMap.put(p.Label, null);	           
            }
        }        
        
        for (Product2 p: [SELECT Id, Name FROM Product2 WHERE Name IN:productMap.keySet()]) {
            productMap.put(p.Name, p.Id);   
        }
        
        for (Prediction p: predictionList) {
            if (p.Selected) {
                qlInsertList.add(
                    new SBQQ__QuoteLine__c(
                        SBQQ__Quote__c = qId,
                        SBQQ__Product__c = productMap.get(p.Label),
                        SBQQ__Quantity__c = 1
                    )
                );                 
            }
        }
        if (!predictionList.isEmpty()) {
        	insert qlInsertList;    
        }
        
        return null;
    }    
    
    public class Prediction {
        public String Label {get; set;}
        public Decimal Probability {get; set;}
        public Boolean Selected {get; set;}
        
        public String getPercentage() {
            return (this.Probability * 100).setScale(2) + '%';
        }        
    }
    
    
}