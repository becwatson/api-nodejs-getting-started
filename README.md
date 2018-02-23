# api-nodejs-getting-started

Node.js example for Elit's API:

# Prerequisites

Install the Heroku CLI
https://devcenter.heroku.com/articles/heroku-cli

Install node.js and npm
https://nodejs.org/en/download/

# Clone and Run Locally 

Clone the github repository:

$ git clone git@github.com:becwatson/api-nodejs-getting-started.git # or clone your own fork

$ cd api-nodejs-getting-started

Install the required packages using npm:

$ npm install

$ node index.js

Node.js should be running at http://localhost:5000/

# Deploy to Heroku

$ heroku create

$ git push heroku master

$ heroku open

# Updating App

Update the code files, commit changes to your local git clone then push local changes to heroku:

$ git commit -a -m "Updated files"

$ git push heroku master

$ heroku open


# API access

Apply for API key via wiapi@elit and set environment variables.


For the locally running test app:

$ export WI_ACCOUNT_ID="<account_id>"

$ export WI_ACCOUNT_TOKEN="<account_token>"


For heroku this can be done as follows:

$ heroku config:set WI_ACCOUNT_ID="<account_id>"

$ heroku config:set WI_ACCOUNT_TOKEN="<account_token>"


To unset variables in heroku use:

$ heroku config:unset WI_ACCOUNT_ID

$ heroku config:unset WI_ACCOUNT_TOKEN


# Documentation

http://docs.englishlanguageitutoring.com/
