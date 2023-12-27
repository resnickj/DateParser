var T = (function() {
    
    var tests = [];
    
    return {
        test: function(name, cases){
            tests.push({ name, cases });
        },
        
        runTests: function(listener) {
            
            var results = [];
            for(var t of tests) {
                var cases = t.cases;
                if(typeof cases === 'function') {
                    cases = cases();
                }
                for(var c of cases) {
                    var input = c[0];
                    var expected = c[1];
                    
                    // Use utc:true by default so that we don't have to worry
                    // about timezones and test breaking depending on time of 
                    // year due to daylight savings.
                    var options = c[2] || { utc: true };
                    var result = { name: t.name, "case": c };
                    try{
                        var actual = dateParser.parse(input, options).toString();
                        if(actual === expected) {
                            result.status = "pass";
                        } else {
                            result.status = "fail";
                        }
                        result.actual = actual;
                    } catch(e) {
                        result.status = "fail";
                        result.error = e;
                    }
                    results.push(result);
                    if(listener && listener.onTestCaseResult) {
                        listener.onTestCaseResult(result);
                    }
                }
            }
            
            return results;
        }
    };
}());

var yr = (new Date()).getFullYear().toString();

var pad = function(number) {
    if (number < 10) {
      return '0' + number;
    }
    return number;
};

T.test("basic", [
    ["Aug 24th 2017", "start=2017-08-24"],
    ["thursday, august 24 2017 at 8 pm", "start=2017-08-24T20:00:00Z"],
    ["thursday, august 24 2017 @ 8 pm", "start=2017-08-24T20:00:00Z"],
    ["thursday, august 24 2017 8 pm", "start=2017-08-24T20:00:00Z"],
    ["thursday, august 24, 2017 8:00 pm - 10:00 pm",
            "start=2017-08-24T20:00:00Z, end=2017-08-24T22:00:00Z"],
]);

T.test("year is inferred", [
    ["Aug 24th", "start="+yr+"-08-24"],
    ["thursday, august 24 8 pm", "start="+yr+"-08-24T20:00:00Z"],
    
    ["thursday, august 24 8:00 pm - 10:00 pm",
        "start="+yr+"-08-24T20:00:00Z, end="+yr+"-08-24T22:00:00Z"],
    
    ["May 27 - December 31 from 12:00 PM - 5:00 PM",
        "start="+yr+"-05-27T12:00:00Z, end="+yr+"-05-27T17:00:00Z, recurDailyUntil="+yr+"-12-31"],
        
    ["May 27 - December 31, 2017 12:00 PM - 5:00 PM",
        "start=2017-05-27T12:00:00Z, end=2017-05-27T17:00:00Z, recurDailyUntil=2017-12-31"],
    
    // two-digit year
    ["May 27 - December 31, 17 12:00 PM - 5:00 PM",
        "start=2017-05-27T12:00:00Z, end=2017-05-27T17:00:00Z, recurDailyUntil=2017-12-31"],
]);

T.test("date is inferred from dayOfWeek", function() {
    var days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    var d = new Date();
    var d2 = new Date();
    d2.setDate(d.getDate() + 4);
    
    return [
        // If the day specified has the same name as the current day, it's perhaps ambiguous whether the
        // parser should interpret it as "today" or "today + 7", but it chooses "today".
        [days[d.getDay()], "start=" + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())],
        
        // For any day name that is not the same as the current day's name, the date is chosen from
        // the coming week.
        [days[d2.getDay()], "start=" + d2.getFullYear() + '-' + pad(d2.getMonth() + 1) + '-' + pad(d2.getDate())],
    ];
});

T.test("relative day", function() {
    var d = new Date();
    var d2 = new Date();
    d2.setDate(d.getDate() + 1);
    
    return [
        ["today", "start=" + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())],
        ["today 8pm", "start=" + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + "T20:00:00Z"],
        
        ["tomorrow", "start=" + d2.getFullYear() + '-' + pad(d2.getMonth() + 1) + '-' + pad(d2.getDate())],
        ["tomorrow 8pm", "start=" + d2.getFullYear() + '-' + pad(d2.getMonth() + 1) + '-' + pad(d2.getDate()) + "T20:00:00Z"],
    ];
});

T.test("date time separators are optional", [
    ["Aug 28th-29th @ 5pm", "start="+yr+"-08-28T17:00:00Z, recurDailyUntil="+yr+"-08-29"],
    ["Aug 28th-29th 5pm", "start="+yr+"-08-28T17:00:00Z, recurDailyUntil="+yr+"-08-29"],
    
    ["May 27 - December 31 from 12:00 PM - 5:00 PM",
        "start="+yr+"-05-27T12:00:00Z, end="+yr+"-05-27T17:00:00Z, recurDailyUntil="+yr+"-12-31"],    
    ["May 27 - December 31 12:00 PM - 5:00 PM",
        "start="+yr+"-05-27T12:00:00Z, end="+yr+"-05-27T17:00:00Z, recurDailyUntil="+yr+"-12-31"],    
]);

T.test("midnight start or end", [
    // midnight start
    ["august 24 2017 12 am", "start=2017-08-24T00:00:00Z"],
    ["august 24 2017 12 am - 2 am", "start=2017-08-24T00:00:00Z, end=2017-08-24T02:00:00Z"],
    ["august 24 2017 12 am - 2 pm", "start=2017-08-24T00:00:00Z, end=2017-08-24T14:00:00Z"],

    // midnight end
    ["august 24 2017 8 pm - 12 am", "start=2017-08-24T20:00:00Z, end=2017-08-25T00:00:00Z"],
    ["august 24 2017 8 am - 12 am", "start=2017-08-24T08:00:00Z, end=2017-08-25T00:00:00Z"],
    ["august 24 2017 12 pm - 12 am", "start=2017-08-24T12:00:00Z, end=2017-08-25T00:00:00Z"],
]);

T.test("noon start or end", [
    // noon start
    ["august 24 2017 12 pm", "start=2017-08-24T12:00:00Z"],
    ["august 24 2017 12 pm - 2 pm", "start=2017-08-24T12:00:00Z, end=2017-08-24T14:00:00Z"],
    ["august 24 2017 12 pm - 2 am", "start=2017-08-24T12:00:00Z, end=2017-08-25T02:00:00Z"],

    // noon end
    ["august 24 2017 10 am - 12 pm", "start=2017-08-24T10:00:00Z, end=2017-08-24T12:00:00Z"],
    ["august 24 2017 12 am - 12 pm", "start=2017-08-24T00:00:00Z, end=2017-08-24T12:00:00Z"],
]);

T.test("crossover timerange", [
    ["august 24 2017 8:00 pm - 4:00 am", "start=2017-08-24T20:00:00Z, end=2017-08-25T04:00:00Z"],
    ["august 24 2017 10:00 am - 4:00 am", "start=2017-08-24T10:00:00Z, end=2017-08-25T04:00:00Z"],
    ["august 24 2017 12:00 pm - 4:00 am", "start=2017-08-24T12:00:00Z, end=2017-08-25T04:00:00Z"],
]);

T.test("timerange infer meridiem", [
    ["dec 25 2023 4-8pm", "start=2023-12-25T16:00:00Z, end=2023-12-25T20:00:00Z"],
    ["dec 25 2023 9-11am", "start=2023-12-25T09:00:00Z, end=2023-12-25T11:00:00Z"],
    ["dec 25 2023 12-3pm", "start=2023-12-25T12:00:00Z, end=2023-12-25T15:00:00Z"],
    ["dec 25 2023 12-3am", "start=2023-12-25T00:00:00Z, end=2023-12-25T03:00:00Z"],
]);