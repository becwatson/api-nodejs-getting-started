var express = require('express');
var session = require('express-session');
var querystring = require('querystring');
var https = require('https');
var bodyParser = require('body-parser');

var app = express();
var urlencodedParser = bodyParser.urlencoded({ extended: true });

//use sessions to store some variables:
app.use(session({secret:'ELITAPI', resave: true, saveUninitialized: true}));

//get the stylesheet file:
app.use(express.static('public'));

var ssn; // session variable
var host = 'api-staging.englishlanguageitutoring.com';

// port to run the server on:
const PORT = process.env.PORT || 5000

//global variables:
app.locals = {
		apiresult: '',
		site: {
			title: 'ELiT API example',
			debug_output: ''
		},
		settings: {
			question_text: 'Write a letter to organise a surprise birthday party',
			WI_ACCOUNT_ID: process.env.WI_ACCOUNT_ID, 
			WI_ACCOUNT_TOKEN: process.env.WI_ACCOUNT_TOKEN, 
			sentence_threshold_high: 0.33,
			sentence_threshold_low: -0.33,
			color_sentence_low: "#ffbc99",
			color_sentence_med: "#ffee99",
			color_sentence_high: "#ffffff",
			color_token_suspect: "#d24a00",
			color_token_error: "#d24aff"
		},
		isStatic: 
			function() { 
				 return app.locals.settings.WI_ACCOUNT_ID == null || app.locals.settings.WI_ACCOUNT_ID == ''
			|| app.locals.settings.WI_ACCOUNT_TOKEN == null || app.locals.settings.WI_ACCOUNT_TOKEN == '';
		},
		getHeader:
			function() {
			return "<!DOCTYPE html PUBLIC \"-//W3C//DTD HTML 4.01 Transitional//EN\""
			+ "\"http://www.w3.org/TR/html4/loose.dtd\">"
			+ "<html lang=\"en\">"
			+ "<head>"
			+ "<meta charset=\"utf-8\">"
			+ "<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">"
			+ "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
			+ "<link rel=\"stylesheet\" href=\"https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css\">"
			+ "<link rel=\"stylesheet\" type=\"text/css\" "
			+ "href=\""
			+ "/style.css\" />"   
			+ "<title>" + app.locals.site.title + "</title>"
			+ "</head>"
			+ "<body>";
		},
		getFooter:
			function() {
			return "<!-- jQuery (necessary for Bootstrap's JavaScript plugins) -->" +
			"<script src=\"https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js\"></script>" +
			"<script src=\"https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js\"></script>" +
			"<script type=\"text/javascript\" src=\"script.js\"></script>" +
			"</body></html>";
		},
		getDebugBox:
			function() {
			if(app.locals.site.debug_output != '') {
				return "<div class=\"container\">" +
				"<div id=\"page-debug\">" +
				"<pre>" + app.locals.site.debug_output + "</pre>"
				"</div></div>";
			} else {
				return "";
			}
		},
		getLoadingBox:
			function(reloadTimeInMillis) {
			var response_str = "<div class=\"container\" id=\"page-loader\">";
			response_str += "<div class=\"loader\"></div>";
			response_str += "</div>";
			response_str += "<form method=\"post\" action=\"/results\" class=\"hidden\">";
			response_str += "<button type=\"submit\" class=\"btn btn-default\" id=\"submit\">Submit</button>";
			response_str += "</form>";
			response_str += "<script type=\"text/javascript\">";
			response_str += "setTimeout(function() {$(\"form.hidden button#submit\").click();}, " 
				+ reloadTimeInMillis +");";
			response_str += "</script>";

			return response_str;
		},
		getRenderedOutput:
			function(responseObject) {

			var inputText = ssn.inputText;

			// map from character positions to html tags:
			var tags = new Object();

			var sentence_scores = responseObject.sentence_scores;
			var suspect_tokens = responseObject.suspect_tokens;
			var textual_errors = responseObject.textual_errors;

			var sent_score, sus_token, text_error;
			var score, start, end;
			var sentence_color;

			for(var i = 0; i < sentence_scores.length; i++) {
				sent_score = sentence_scores[i];

				score = sent_score[2];
				start = sent_score[0];
				end = sent_score[1];
				
				if(score < app.locals.settings.sentence_threshold_high && score > app.locals.settings.sentence_threshold_low){
					sentence_color = app.locals.settings.color_sentence_med;
				}
				else if(score < app.locals.settings.sentence_threshold_low){
					sentence_color = app.locals.settings.color_sentence_low;
				}
				else{
					sentence_color = app.locals.settings.color_sentence_high;
				}
				tags[start] = "<span style=\"background-color:" + sentence_color +
				"\" data-sentence-score=\"" + score + "\">";
				tags[end] = "</span>";
			}

			for(var i=0; i < suspect_tokens.length; i++) {
				sus_token = suspect_tokens[i];
				start = sus_token[0];
				end = sus_token[1];
				tags[start] = "<span style=\"border:2px solid " + app.locals.settings.color_token_suspect + ";\">";
				tags[end] = "</span>";
			}

			for(var i=0; i < textual_errors.length; i++) {
				text_error = textual_errors[i];
				start = text_error[0];
				end = text_error[1];
				tags[start] = "<span style=\"border:2px solid " + app.locals.settings.color_token_error + ";\">";
				tags[end] = "</span>";
			}

			//for (var tag in tags) {
			//	console.log("tag:" + tag + " = " + tags[tag]);
			//}
			
			var processed_text = "";

			var idx = 0;
			for (var v of inputText) {
				if(typeof tags[idx] !== 'undefined'){
					processed_text += tags[idx];
				}
				if(idx < inputText.length)
					processed_text += v;
				idx++;
			}
			
			var response_str =  "<div class=\"container\" id=\"page-output\">"
				+ "<div id=\"output\">"
				+ "<h3>" + app.locals.settings.question_text + "</h3>"
				+ "<div class=\"overall_score\">"
				+ "<strong>Overall score:</strong> " + responseObject.overall_score +"</div>"
				+ "<div id=\"analysis\" style=\"line-height:160%;\">" + processed_text
				+ "</div></div>"
				+ "<form action=\"" + "/" 
				+ "\">"
				+ "<button type=\"submit\" class=\"btn btn-default\" id=\"submit\">Try again</button>"
				+ "</form>"
				+ "</div>";

			return response_str;
		},
		performRequest:
			function (response, urlhost, endpoint, method, data, inputText, success) {

			var dataString = JSON.stringify(data);

			var headers;

			// static eg:
			if(app.locals.isStatic()) {
				headers = {
						'Content-Type': 'application/json',
						'Content-Length': dataString.length
				};
			} else { // api call requires authentication in header:
				headers = {
						'Content-Type': 'application/json',
						'Content-Length': dataString.length,
						'Authorization': 'Token token=' + app.locals.settings.WI_ACCOUNT_TOKEN
				};

			}

			if (method == 'GET' && data != null) {
				endpoint += '?' + querystring.stringify(data);
			}

			var options = {
					host: urlhost,
					path: endpoint,
					method: method,
					headers: headers
			};

			var req = https.request(options, function(res) {
				res.setEncoding('utf-8');

				var responseString = '';

				res.on('data', function(data) {
					responseString += data;
				});

				res.on('end', function() {
					console.log(responseString);
					success(responseString, response, inputText)
				});
			});

			req.write(dataString);
			req.end();
		}

};

var server = app.listen(PORT, function () {
	var host = server.address().address
	var port = server.address().port
	console.log("Example app listening at %s:%s Port", host, port)
});

app.get('/', function (req, res) {
	var inputText = "";

	ssn = req.session;
	ssn.comport; 
	ssn.command; 

	if(ssn && ssn.inputText) {
		inputText = ssn.inputText;
		inputText = inputText.replace(/<br\s*[\/]?>/gi, "\n");
	}

	var response_str = app.locals.getHeader();

	response_str += "<div class=\"container\" id=\"page-input\">";

	if(app.locals.isStatic()) {
		response_str += "<p>API credentials unavailable - please set to use live API.</p>";
		response_str += "<p>Text is not editable. This example will not connect to the API "
			+ "but instead use example JSON file returned from the API. "
			+ "Please contact ELiT to apply for free trial API access.</p>";
	}	

	response_str += "<h3>" + app.locals.settings.question_text + "</h3>";
	response_str += "<form method=\"post\" action=\"/submit\">";
	response_str += "<div class=\"form-group\">";

	if(app.locals.isStatic()) {
		inputText = "Dear Mrs Brown,\n\n" 
			+ "I am writing in connection with a surprise birthday party for your husband, "
			+ "Mr. Brown. We are writing to invite you and to give you some information "
			+ "about the party. All our class love Mr Brown very much, so we decided to "
			+ "organise a surprise party for him. The party in on Tuesday 16 of June. "
			+ "You should come on 3 pm in college Canteen . "
			+ "We have bought some snaks to eat and three students will sing for him, also . "
			+ "Besides this, we have invited all other teachers and the Principal of our school. "
			+ "Of course all the class will take party to this party. "
			+ "Furthermore , we don't know what present buying for him. "
			+ "So we would appreciate if you help us with this matter. "
			+ "We have thought to buy a cd or a book. He loves to read books. "
			+ "What do you believe ? If he needs something else, we are happy to buy this. "
			+ "I am looking forward to hearing from you soon especially as I am concerned "
			+ "about this matter.\n\n"
			+ "Yours sincerely,\n\n"
			+ "John Smith";

		response_str += "<textarea id=\"input_text\" class=\"form-control\" "
			+ "name=\"inputText\" readonly>" 
			+ inputText
			+ "</textarea>";

	} else {
		response_str += "<textarea id=\"input_text\" class=\"form-control\" name=\"inputText\">" 
			+ inputText
			+ "</textarea>";
	}

	response_str += "</div>"
		+ "<button type=\"submit\" class=\"btn btn-default\" id=\"submit\">Submit</button>";	

	response_str += "</form></div>";
	response_str += app.locals.getFooter();

	res.send(response_str);
});


app.post('/submit', urlencodedParser, function (req, res){

	// save in session:
	ssn = req.session;

	var inputText=req.body.inputText;
	inputText = inputText.replace(/(\r\n|\n|\r)/gm,' <br>');
	inputText = inputText.replace(/ +/g,' ');
	ssn.inputText = inputText;

	if(app.locals.isStatic()) {
		
		// just show loading box and go to the GET request	
		var response_str = app.locals.getHeader();

		response_str += app.locals.getLoadingBox(1000);

		app.locals.site.debug_output = "Loading static API example - no API credentials available";

		response_str += app.locals.getDebugBox();
		response_str += app.locals.getFooter();
		res.send(response_str);

	} else {

		var text_id = (new Date()).getTime(); // nounce
		ssn.text_id = text_id;

		var senddata = {
				author_id: "becauthor",
				task_id: "task1",
				session_id: ""+text_id,
				question_text: app.locals.settings.question_text,
				text:inputText,
				test: 1
		};

		app.locals.performRequest(res, host, '/v2.0.0/account/' + app.locals.settings.WI_ACCOUNT_ID + '/text/' + text_id, 'PUT', senddata,
				inputText, function(data, response, inputText) {

			var response_str = app.locals.getHeader();

			var proc_text = data;

			var responseObject = JSON.parse(data);

			app.locals.site.debug_output = //inputText; 
				JSON.stringify(responseObject, null, 4);

			// loading screen if successful:
			if(responseObject.type == "success") {
				// submitted ok - refresh in 1 second:
				response_str += app.locals.getLoadingBox(1000);
			} 
			response_str += app.locals.getDebugBox();
			response_str += app.locals.getFooter();
			response.send(response_str);
		});
	}
});

app.post('/results', urlencodedParser, function (req, res){

	ssn = req.session;
	var text_id = ssn.text_id;
	var inputText = ssn.inputText;

	if(app.locals.isStatic()) {

		app.locals.performRequest(res, "s3-eu-west-1.amazonaws.com", 
				"/elit-website-media/results-example-api.json", 'GET', null,
				inputText, function(data, response, inputText) {

			var responseObject = JSON.parse(data);

			app.locals.site.debug_output = 
				JSON.stringify(responseObject, null, 4);

			var response_str = app.locals.getHeader();
			response_str += app.locals.getRenderedOutput(responseObject);
			response_str += app.locals.getDebugBox();
			response_str += app.locals.getFooter();
			response.send(response_str);
		});

	} else {

		app.locals.performRequest(res, host, '/v2.0.0/account/' + 
				app.locals.settings.WI_ACCOUNT_ID + '/text/' + text_id + '/results', 
				'GET', null, inputText,
				function(data, response, inputText) {


			var response_str = app.locals.getHeader();
			var responseObject = JSON.parse(data);

			app.locals.site.debug_output = JSON.stringify(responseObject, null, 4);

			// display results if successful:
			if(responseObject.type == "success") {

				response_str += app.locals.getRenderedOutput(responseObject);

			} else if(responseObject.type == "results_not_ready") {
				
				// reload page again in the suggested timeframe:
				// estimated seconds to complete may reduce to 0 before completion if we have 
				// underestimated the time to complete the task therefore, make sure we wait at
				// least 1 second before refreshing:
				var reLoadTime = responseObject.estimated_seconds_to_completion * 1000;
				reLoadTime = Math.max(reLoadTime,1000);

				// loading page:
				response_str += app.locals.getLoadingBox(reLoadTime);	
				
			} else {
				response_str += "Unknown response type:" + responseObject.type;
			}

			response_str += app.locals.getDebugBox();
			response_str += app.locals.getFooter();
			res.send(response_str);

		});
	}
});



