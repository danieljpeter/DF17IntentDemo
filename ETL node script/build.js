var csv = require('csv-parser')
var fs = require('fs')
 
var quotes = {};
var products = {};
var quoteLines = {}; 
var labels = {};
var quotesWithAddons = {};

//initialize an object for Einstein training
var md = {"intents":{}};

var addonProdFamilies = {
	'Accessories - Soft Goods': true,
	'Accessories Hardware': true,
	'Accessory Print': true,
	'Flag Hardware': true,
	'Flags': true,
	'FUGU Cover': true,
	'FUGU Hardware': true,
	'GYBE - Accessories': true,
	'Table Cover Print': true,
	'Table Covers': true
};

/*
addonProdFamilies = {
	'Accessories Hardware': true
};
*/

/*
var ignoreProducts = {
	'Shipping - FedEx Ground Service': true
}
*/
var ignoreCustomers = {
	'Church of Scientology - International Liason Office': true
}

fs.createReadStream('SBQQ__Quote__c.csv')
  .pipe(csv())
  .on('data', function (data) {
	quotes[data.ID] = data;
  })
  .on('end', function () {


	fs.createReadStream('SBQQ__QuoteLine__c.csv')
	  .pipe(csv())
	  .on('data', function (data) {
		//get the quote for this line
		var q = quotes[data.SBQQ__QUOTE__C];
		if (q.OPPORTUNITY_STAGE__C.indexOf('Approved') != -1) {
			var prodName = data.SBQQ__PRODUCTNAME__C;
			var prodNameOrig = prodName;
			var custName = q.SBQQ__BILLINGNAME__C;

			//prodName.replace(/[^a-zA-Z0-9 ]/g, "");
			//prodName = data.SBQQ__PRODUCT__C;

			var isShipping =(
				(prodNameOrig.toLowerCase().indexOf('fedex') != -1) ||
				(prodNameOrig.toLowerCase().indexOf('shipping') != -1)
			);

			prodName = prepProdName(prodName);

			if ( (!isShipping) && (!(custName in ignoreCustomers)) ) {
			
				if (!(data.SBQQ__QUOTE__C in quoteLines)) {
					quoteLines[data.SBQQ__QUOTE__C] = {};
					quoteLines[data.SBQQ__QUOTE__C].customer = custName;
					quoteLines[data.SBQQ__QUOTE__C].products = {};
				}
				
				var isAddon = (data.SBQQ__PRODUCTFAMILY__C in addonProdFamilies);

				//examples get the prepped prod name, labels (Add ons) get the original name.
				var prodNameToUse = (isAddon ? prodNameOrig : prodName);


				quoteLines[data.SBQQ__QUOTE__C].products[prodNameToUse] = {'isAddon': isAddon};	

				if (isAddon) {
					labels[prodNameToUse] = {};
					quotesWithAddons[data.SBQQ__QUOTE__C] = true;
				}
			}
		}
	  })
	  .on('end', function () {
	  	gotQuotes();
	})

})

function gotQuotes() {

	//loop through quotes that had addOns
	for (qId in quotesWithAddons) {
		var quote = quoteLines[qId];
		var customer = quote.customer;
		var products = quote.products;
		
		var coreProducts = [];
		var addOnProducts = [];
		for (var product in products) {
			var isAddon = products[product].isAddon;
			if (isAddon) {
				addOnProducts.push(product);
			} else {
				coreProducts.push(product);
			}
		}
		coreProducts.sort();
		addOnProducts.sort();


		for (var i=0; i<addOnProducts.length; i++) {
			var addOn = addOnProducts[i];

			//build an array of the customer name with all the core products to start
			var values = JSON.parse(JSON.stringify(coreProducts));
			//var values = ['Customer: ' + customer].concat(JSON.parse(JSON.stringify(coreProducts)));
			//var values = ['Customer: ' + customer].concat(prependToArray('Product: ', coreProducts));

			//var values = [];

			//make an array of the addOns, not including this addon
			//var otherAddons = JSON.parse(JSON.stringify(addOnProducts));
			//var otherAddons = prependToArray('', addOnProducts);
			//otherAddons.splice(i,1);
			//values = values.concat(otherAddons);

			var valString = values.join(' ');

			if (!(addOn in md.intents)) {
				md.intents[addOn] = [];
			}
			if ( (valString != '') && (md.intents[addOn].indexOf(valString) == -1) )  {
				md.intents[addOn].push(valString);	
			}
			
		}
	}


	//do a pass over the object to count the duplicate examples
	var exampleCount = {};
	for (var label in md.intents) {	
		for (var i=0; i<md.intents[label].length; i++) {
			var example = md.intents[label][i];
			if (example in exampleCount) {
				exampleCount[example]++;
			} else {
				exampleCount[example] = 1;
			}
		}
	}



	//do a pass over the object and remove any subsequent duplicates
	//only keep the first occurance
	var firstDupe = {};
    for (var label in md.intents) {

		//loop backwards since we are doing an array splice
		//don't want to mess up the indexing
		for (var i = md.intents[label].length - 1; i >= 0; i--) {
			var example = md.intents[label][i];
			if (exampleCount[example] > 1) {
				if (example in firstDupe) {
					//remove it
					md.intents[label].splice(i, 1);
				} else {
					firstDupe[example] = true;
					//don't remove it since it's the first occurance
				}
			}
		}
    }


	//do a pass over the object and remove any keys that have fewer than 5 values
	//einstein needs 5 values min
    for (var label in md.intents) {
        if (md.intents[label].length < 5) {
        	delete md.intents[label];   
        }
    }

	//*** HACK ***
	//do a pass over the object and add the label to any duplicate examples
	//to make them unique 
    /*
    for (var label in md.intents) {
		for (var i=0; i<md.intents[label].length; i++) {
			var example = md.intents[label][i];
			if (exampleCount[example] > 1) {
				md.intents[label][i] = label + ' ' + example; 
			}
		}
    }
    */	

	console.log(JSON.stringify(md));
	//console.log(convertObjToCSV());
}


function prepProdName(prodName) {
	var wordsToKeep = 4;

	var output = '';

	//first run a regex replace to only keep letters and spaces
	output = prodName.replace(/[^a-zA-Z ]/g, '');

	//tokenize into words
	var arrWords = output.split(' ');
	var arrWordsToKeep = [];

	//only keep words > 2 letters
	//only keep the first x words
	for (var i=0; i<arrWords.length; i++) {
		var word = arrWords[i].trim();
		if (word.length > 2) {
			if (arrWordsToKeep.length <= wordsToKeep) {
				arrWordsToKeep.push(word);	
			} else {
				break;
			}
		}
	}

	output = arrWordsToKeep.join(' ');

	return output;
}


function prependToArray(pre, arr) {
	var newArr = JSON.parse(JSON.stringify(arr));

	for (var i=0; i<newArr.length; i++) {
		newArr[i] = pre + newArr[i];
	}

	return newArr;
}

function convertObjToCSV() { 
	var lines = [];

	var counter = 0;
	var limit = 250;

    for (var label in md.intents) {
		counter++
		if (counter == limit) {
			//break;
		}

        for (var i=0; i<md.intents[label].length; i++) {
        	var line = '"' + md.intents[label][i] + '","' + label +'"';
       		lines.push();
       	}
    }	

	return lines.join('\n');
}



