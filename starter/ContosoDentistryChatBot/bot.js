// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const { config } = require('dotenv');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

config({path: '.env'});

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

        // create a QnAMaker connector
        this.QnAMaker = new QnAMaker(configuration.QnAConfiguration, qnaOptions)
       
        // create a DentistScheduler connector
        this.DentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration)
        // create a IntentRecognizer connector
        this.IntentRecognizer = new IntentRecognizer()

        this.onMessage(async (context, next) => {
            // send user input to QnA Maker and collect the response in a variable
            // don't forget to use the 'await' keyword
            const qnaResults = await this.QnAMaker.getAnswers(context);
            // send user input to IntentRecognizer and collect the response in a variable
            // don't forget 'await'
            const LuisResult = await this.IntentRecognizer.executeLuisQuery(context)
            if (LuisResult.luisResult.prediction.topIntent === "GetAvailability"  &&
                LuisResult.intents.GetAvailability.score > .50
            ) {
                const availability = this.DentistScheduler.getAvailability()
                await context.sendActivity(availability)
            } else if (
                LuisResult.luisResult.prediction.topIntent === "ScheduleAppointment" &&
                LuisResult.intents.ScheduleAppointment.score > .50 &&
                LuisResult.entities.$instance &&
                LuisResult.entities.$instance.datetime &&
                LuisResult.entities.$instance.datetime[0]
            ) {
                const appointment = LuisResult.entities.$instance.datetime[0]
                const schedule = this.DentistScheduler.scheduleAppointment(appointment)
                await context.sendActivity(schedule)
            } else if (qnaResults[0]) {
                console.log(qnaResults[0])
                await context.sendActivity(`${qnaResults[0].answer}`);
            } else {
                await context.sendActivity(`I'm not sure I found an answer to your question`);
            }
            // determine which service to respond with based on the results from LUIS //

            // if(top intent is intentA and confidence greater than 50){
            //  doSomething();
            //  await context.sendActivity();
            //  await next();
            //  return;
            // }
            // else {...}
             
            await next();
    });

        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = `Hello! We love your smile. :)
        You can inquire about our office hours here, schedule your appointment or
        ask general questions. We will try to answer you professionally `;
        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });
    }
}

module.exports.DentaBot = DentaBot;
