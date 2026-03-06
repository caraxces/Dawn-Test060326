const { JSDOM } = require("jsdom");
const dom = new JSDOM();
const document = dom.window.document;

var gwPropKey = "<span title='translation missing'>_Gift Wrap</span>";
var div = document.createElement('div');
div.innerHTML = gwPropKey;
var cleanPropKey = div.textContent || div.innerText || gwPropKey;
console.log("cleanPropKey is:", cleanPropKey, cleanPropKey === "_Gift Wrap");
