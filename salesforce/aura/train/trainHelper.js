({
     refresh : function(component, event) {
		var einsteinToken = component.get("v.einsteinToken");
        var h = this;
         
         $.ajax({
             url: "https://df17demo.herokuapp.com/datasetsDetail",
             type: "GET",
             headers: {"Cache-Control": "no-cache", "Authorization": "Bearer " + einsteinToken},
             success: function(datasetsDetail) {
                 console.log('datasetsDetail', datasetsDetail);
                 
                 var datasets = JSON.parse(datasetsDetail);
                 console.log('datasets', datasets);                                                     
                 component.set("v.datasets", datasets);  
                 h.hideSpinner(component, event);                 
             },
             error: function (xhr, textStatus, errorThrown) {
                 console.log('error', xhr, textStatus, errorThrown);
                 h.hideSpinner(component, event);  
             }            
         });             
         
     },
    showSpinner : function(component, event) {
        var spinner = component.find('spinner');
        var event = spinner.get("e.toggle");
        event.setParams({ isVisible : true }); 
        event.fire();
    },   
    hideSpinner : function(component, event) {
        var spinner = component.find('spinner');
        var event = spinner.get("e.toggle");
        event.setParams({ isVisible : false });    
        event.fire();
    },       
    getDefaultKey : function() {
var key =
`-----BEGIN RSA PRIVATE KEY-----
-----END RSA PRIVATE KEY-----`;
        return key;
	},
    getDefaultJSON : function() {

        var json =
`{
  "intents": {
    "a230Y0000018C6J": [
      "what's the weather look like",
      "is it raining",
      "what's the temperature",
      "show me current conditions",
      "how hot is it",
      "how cold is it",
      "is it snowing",
      "is it raining",
      "is it sunny",
      "is it cloudy",
      "is it raining in Detroit",
      "how is Denver today",
      "is Chicago cold",
      "i sMiami hot",
      "show me the current conditions",
      "what's the temperature in new york",
      "show me current conditions for san francisco",
      "what's the weather look like in Chicago",
      "is it raining in Seattle",
      "what's the temperature in New York",
      "show me current conditions for Boston",
      "how hot is it in Miami",
      "how cold is it Anchorage",
      "is it snowing in Denver",
      "show me the current conditions for Detroit",
      "show me current conditions for boston",
      "how hot is it in miami",
      "how cold is it in anchorage",
      "is it snowing in denver",
      "show me the current conditions for detroit"
    ],
    "a230Y0000018C6H": [
      "will it rain tomorrow",
      "how dos the weather look for Thursday",
      "is is going to snow this week",
      "show me the forecast",
      "what's the five day forecast",
      "will it rain this week",
      "how does this week look in Los Angelos",
      "how does it look for Monday",
      "will it rain on Friday",
      "is it going to be hot Wednesday",
      "how does the rest of the week look",
      "will it rain tomorrow in Munich",
      "how dos the weather look for this Thursday in Boston",
      "is is going to snow this week in  Chicago",
      "show me the forecast for Denver",
      "show me the weather for Salt Lake City  this Tuesday",
      "what's the five day forecast for Detroit ",
      "how does it look for this Monday in New York",
      "will it rain in Denver on Friday",
      "is it going to be hot in Boston  this Wednesday",
      "how New York  look the rest of the week look"
    ],
    "a230Y0000018C6G": [
      "how does tonight look",
      "is it going to rain this afternoon",
      "is it going to snow in Detroit",
      "does it look like rain",
      "does it look lie snow",
      "is it windy",
      "it is sunny",
      "will it rain tonight",
      "how cold will it be this afternoon",
      "will it be cloudy",
      "is it going to be hot tonight",
      "will it rain this morning",
      "will it rain",
      "will is snow",
      "is it going to get warmer today",
      "how does tonight look in boston",
      "is it going to rain this afternoon in chicago",
      "will it rain this morning miami",
      "is it going to get warmer today houston",
      "how does tonight look in austin",
      "is it going to rain this afternoon in san francisco",
      "will it rain this morning Seattle",
      "is it going to get warmer today Portland"
    ]
  }
}`;

        
        return json;
    }    
})