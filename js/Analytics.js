/*global Options */
"use strict";

var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-9285544-4']);

if (Options.get("usage-tracking")) {
    _gaq.push(['_trackPageview']);
}

addEventListener("load", function () {
    var ga = document.createElement('script');
    ga.type = 'text/javascript';
    ga.async = true;
    ga.src = 'https://ssl.google-analytics.com/ga.js';

    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
}, true);
