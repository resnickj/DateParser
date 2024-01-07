var T = (function() {
   
    // Use utc:true by default so that we don't have to worry
    // about timezones and test breaking depending on time of 
    // year due to daylight savings.
    const defaultOptions = { utc: true };
    
    const tests = [];
    
    const runTestCase = function(t, c) {
        let input = c[0];
        let expected = c[1];
        
        let options = { ... defaultOptions, ... c[2] };
        let result = { name: t.name, "case": c };
        try{
            let actual = dateParser.parse(input, options).toString();
            if(expected === undefined) {
                // expected exception but didn't get one
                result.status = "fail";
            } else {
                result.status = (actual === expected) ? "pass" : "fail";
            }
            result.actual = actual;
        } catch(e) {
            result.status = (expected === undefined)
                ? "pass" // exception expected
                : "fail";
            result.error = e;
        }
        return result;
    };
    
    const runTest = function(t) {
        let cases = t.cases;
        if(typeof cases === 'function') {
            cases = cases();
        }
        return cases.map(c => runTestCase(t, c));
    };
     
    return {
        test: function(name, cases){
            tests.push({ name, cases });
        },
        
        runTests: function(listener) {
            
            const allResults = [];
            let i = 0;
            const runNext = function() {
                if(!tests[i]) {
                    if(listener.onAllTestsCompleted) {
                        listener.onAllTestsCompleted(allResults);
                    }
                    return;
                }
                
                const t = tests[i++];
                const testResults = runTest(t);
                allResults.push(... testResults);
                if(listener.onTestCompleted) {
                    listener.onTestCompleted(testResults);
                }
                
                setTimeout(runNext);
            };
            
            setTimeout(runNext);
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

T.test("parse date", [
    
    // day first
    ["24 08 2017", "start=2017-08-24"],
    ["24/08/2017", "start=2017-08-24"],
    ["24-08-2017", "start=2017-08-24"],
    ["24.08.2017", "start=2017-08-24"],
    ["24th Aug 2017", "start=2017-08-24"],
    
    // month first
    ["08 24 2017", "start=2017-08-24"],
    ["08/24/2017", "start=2017-08-24"],
    ["08-24-2017", "start=2017-08-24"],
    ["08.24.2017", "start=2017-08-24"],
    ["Aug 24th 2017", "start=2017-08-24"],

    // year first
    ["2017 08 24", "start=2017-08-24"],
    ["2017/08/24", "start=2017-08-24"],
    ["2017-08-24", "start=2017-08-24"],
    ["2017.08.24", "start=2017-08-24"],
    ["2017 Aug 24th", "start=2017-08-24"],

    // year first
    // (succeeds despite potential ambiguity of day/month, because when year is
    // placed first, Y-M-D format is assumed, as opposed to Y-D-M)
    ["2017 08 10", "start=2017-08-10"],
    ["2017/08/10", "start=2017-08-10"],
    ["2017-08-10", "start=2017-08-10"],
    ["2017.08.10", "start=2017-08-10"],
    
    // with day-of-week
    ["Thursday, Aug 24th 2017", "start=2017-08-24"],
    ["Thursday, 24th Aug 2017", "start=2017-08-24"],
]);

T.test("parse date - ambiguous", [
    
    // day first
    ["10 08 2017", undefined],
    ["10/08/2017", undefined],
    ["10-08-2017", undefined],
    ["10.08.2017", undefined],
    
    // month first
    ["08 10 2017", undefined],
    ["08/10/2017", undefined],
    ["08-10-2017", undefined],
    ["08.10.2017", undefined],

    // two-digit year first
    ["17 08 10", undefined],
    ["17/08/10", undefined],
    ["17-08-10", undefined],
    ["17.08.10", undefined],
    
    // If we force it to choose 'first', it chooses the M-D-Y interpretation
    ["10 08 2017", "start=2017-10-08", { ambiguityHandling: 'first' }],
    ["08 10 2017", "start=2017-08-10", { ambiguityHandling: 'first' }],
]);

T.test("parse datetime", [
    ["Aug 24 2017 at 8 pm", "start=2017-08-24T20:00:00Z"],
    ["Aug 24 2017 @ 8 pm", "start=2017-08-24T20:00:00Z"],
    ["Aug 24 2017 8 pm", "start=2017-08-24T20:00:00Z"],
    ["Aug 24 2017 8:15 pm", "start=2017-08-24T20:15:00Z"],
    ["Aug 24 2017 8:15 am", "start=2017-08-24T08:15:00Z"],
    ["Aug 24 2017 8:15", "start=2017-08-24T08:15:00Z"],
    ["Aug 24 2017 8:00p", "start=2017-08-24T20:00:00Z"],
    ["2017 08 24  8:00pm", "start=2017-08-24T20:00:00Z"],
]);

T.test("parse date-range", [
    ["Aug 24th 2017 - Aug 27th 2017", "start=2017-08-24, end=2017-08-27"],
    ["Aug 24th - 27th 2017", "start=2017-08-24, end=2017-08-27"],
    ["24th - 27th Aug 2017", "start=2017-08-24, end=2017-08-27"],
    ["Aug 24th 2017 - Sep 27th 2017", "start=2017-08-24, end=2017-09-27"],
    ["Aug 24th - Sep 27th 2017", "start=2017-08-24, end=2017-09-27"],
    ["Aug 24th 2016 - Sep 27th 2017", "start=2016-08-24, end=2017-09-27"],
]);

T.test("parse date + time-range", [
    ["Aug 24 2017 8:00 pm - 10:00 pm",
            "start=2017-08-24T20:00:00Z, end=2017-08-24T22:00:00Z"],
    ["Aug 24 2017 @ 8:00 pm - 10:00 pm",
            "start=2017-08-24T20:00:00Z, end=2017-08-24T22:00:00Z"],
    ["Aug 24 2017 from 8:00 pm - 10:00 pm",
            "start=2017-08-24T20:00:00Z, end=2017-08-24T22:00:00Z"],
    ["Aug 24 2017 8:00 - 10:00 pm",
            "start=2017-08-24T20:00:00Z, end=2017-08-24T22:00:00Z"],
    ["Aug 24 2017 8 - 10 pm",
            "start=2017-08-24T20:00:00Z, end=2017-08-24T22:00:00Z"],
    ["Aug 24 2017 8 am - 10 pm",
            "start=2017-08-24T08:00:00Z, end=2017-08-24T22:00:00Z"],
            
    // examples taken from real website
    ["5:30pm - 6:00pm Saturday 30th December",
        "start="+yr+"-12-30T17:30:00Z, end="+yr+"-12-30T18:00:00Z"],
    ["05:30 PM - 06:00 PM Saturday, December 30",
        "start="+yr+"-12-30T17:30:00Z, end="+yr+"-12-30T18:00:00Z"],
]);

T.test("parse datetime range", [
    ["May 27, 2017 5pm - May 30, 2017 12pm", 
        "start=2017-05-27T17:00:00Z, end=2017-05-30T12:00:00Z"],
]);

T.test("parse date-range + time", [
    ["Aug 28th-29th 2017 5pm",
        "start=2017-08-28T17:00:00Z, recurDailyUntil=2017-08-29"],
    ["Aug 24th 2016 - Sep 27th 2017 9am",
        "start=2016-08-24T09:00:00Z, recurDailyUntil=2017-09-27"],
]);

T.test("parse date-range + time-range", [
    ["May 27 2017 - December 31 2017 12:00 PM - 5:00 PM",
        "start=2017-05-27T12:00:00Z, end=2017-05-27T17:00:00Z, recurDailyUntil=2017-12-31"],
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
        ["8pm today", "start=" + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + "T20:00:00Z"],
        
        ["tomorrow", "start=" + d2.getFullYear() + '-' + pad(d2.getMonth() + 1) + '-' + pad(d2.getDate())],
        ["tomorrow 8pm", "start=" + d2.getFullYear() + '-' + pad(d2.getMonth() + 1) + '-' + pad(d2.getDate()) + "T20:00:00Z"],
        ["8pm tomorrow", "start=" + d2.getFullYear() + '-' + pad(d2.getMonth() + 1) + '-' + pad(d2.getDate()) + "T20:00:00Z"],
    ];
});

T.test("date-time separators are optional", [
    ["Aug 28th-29th @ 5pm", "start="+yr+"-08-28T17:00:00Z, recurDailyUntil="+yr+"-08-29"],
    ["Aug 28th-29th 5pm", "start="+yr+"-08-28T17:00:00Z, recurDailyUntil="+yr+"-08-29"],
    
    ["May 27 - December 31 from 12:00 PM - 5:00 PM",
        "start="+yr+"-05-27T12:00:00Z, end="+yr+"-05-27T17:00:00Z, recurDailyUntil="+yr+"-12-31"],    
    ["May 27 - December 31 12:00 PM - 5:00 PM",
        "start="+yr+"-05-27T12:00:00Z, end="+yr+"-05-27T17:00:00Z, recurDailyUntil="+yr+"-12-31"],    
]);

T.test("midnight start", [
    ["august 24 2017 12 am", "start=2017-08-24T00:00:00Z"],
    ["august 24 2017 12 am - 2 am", "start=2017-08-24T00:00:00Z, end=2017-08-24T02:00:00Z"],
    ["august 24 2017 12 am - 2 pm", "start=2017-08-24T00:00:00Z, end=2017-08-24T14:00:00Z"],
]);

T.test("midnight end", [
    ["august 24 2017 8 pm - 12 am", "start=2017-08-24T20:00:00Z, end=2017-08-25T00:00:00Z"],
    ["august 24 2017 8 am - 12 am", "start=2017-08-24T08:00:00Z, end=2017-08-25T00:00:00Z"],
    ["august 24 2017 12 pm - 12 am", "start=2017-08-24T12:00:00Z, end=2017-08-25T00:00:00Z"],
]);

T.test("noon start", [
    ["august 24 2017 12 pm", "start=2017-08-24T12:00:00Z"],
    ["august 24 2017 12 pm - 2 pm", "start=2017-08-24T12:00:00Z, end=2017-08-24T14:00:00Z"],
    ["august 24 2017 12 pm - 2 am", "start=2017-08-24T12:00:00Z, end=2017-08-25T02:00:00Z"],
]);

T.test("noon end", [
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