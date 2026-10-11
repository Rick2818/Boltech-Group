const test = require('node:test');
const assert = require('node:assert/strict');
const {parseFeed,score} = require('../scripts/blia01-discovery.cjs');
const now = new Date().toUTCString();
const xml = (items) => '<rss><channel>'+items.map(x=>'<item><title>'+x.title+'</title><link>'+x.link+'</link><description>'+x.description+'</description><pubDate>'+x.date+'</pubDate></item>').join('')+'</channel></rss>';
test('parses recent public candidate but does not claim verified buyer',()=>{
 const items=parseFeed(xml([{title:'Seeking vendors for AI chatbot',link:'https://example.org/rfp',description:'request for proposal',date:now}]),'US');
 assert.equal(items.length,1);
 assert.equal(items[0].status,'RESEARCH_REQUIRED');
 assert.equal(items[0].buyer_verified,false);
 assert.equal(items[0].contact_verified,false);
 assert.equal(items[0].buying_intent_verified,false);
 assert.ok(items[0].score>0);
});
test('rejects non-https links and invalid dates',()=>{
 const items=parseFeed(xml([{title:'Test',link:'http://example.org/a',description:'',date:now},{title:'Test2',link:'https://example.org/b',description:'',date:'invalid'}]),'US');
 assert.equal(items.length,0);
});
test('score never invents buying intent from neutral text',()=>{assert.equal(score('Company news','Business update'),0);});
