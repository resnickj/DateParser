// UMD (Universal Module Definition)
(function (root, factory) {
    if (typeof define === 'function') {
        // AMD or Jumper. Register as an anonymous module.
        define(factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.dateParser = factory();
  }
}(this, function () {

    //////////////////////////////////////////////////////////////////////////////////////
    // Constants

    var TokenType = {
        word: 0,
        number: 1,
        punct: 2,
        whitespace: 3,
        other: 4
    };
    
    var AstNodeType = {
        // Leaf nodes (primitives)
        dayOfWeek: 1,
        relativeDay: 2,
        day: 3,
        month: 4,
        year: 5,
    
        hour: 6,
        minute: 7,
        meridiem: 8,
    
        datePartSeparator: 10,
        hourMinuteSeparator: 11,
        dateTimeSeparator: 12,
        timeDateSeparator: 13,
        rangeSeparator: 14,
    
        // Inner nodes
        date: 20,
        dateRange: 21,
        time: 22,
        timeRange: 23,
        dateTime: 24,
        dateTimeRange: 25,
        
        // Root node
        phrase: 30,
    
        format: function(type) {
            switch(type){
                case AstNodeType.dayOfWeek: return "dayOfWeek";
                case AstNodeType.relativeDay: return "relativeDay";
                case AstNodeType.day: return "day";
                case AstNodeType.month: return "month";
                case AstNodeType.year: return "year";
                case AstNodeType.hour: return "hour";
                case AstNodeType.minute: return "minute";
                case AstNodeType.meridiem: return "meridiem";
                case AstNodeType.datePartSeparator: return "datePartSeparator";
                case AstNodeType.hourMinuteSeparator: return "hourMinuteSeparator";
                case AstNodeType.dateTimeSeparator: return "dateTimeSeparator";
                case AstNodeType.timeDateSeparator: return "timeDateSeparator";
                case AstNodeType.rangeSeparator: return "rangeSeparator";
                case AstNodeType.date: return "date";
                case AstNodeType.dateRange: return "dateRange";
                case AstNodeType.time: return "time";
                case AstNodeType.timeRange: return "timeRange";
                case AstNodeType.dateTime: return "dateTime";
                case AstNodeType.dateTimeRange: return "dateTimeRange";
                case AstNodeType.phrase: return "phrase";
                default: return "(unknown)";
            }
        }
    };
    
    var DayNames = {
        'su' : 'sun',
        'sun' : 'sun',
        'sunday' : 'sun',
        'mo' : 'mon',
        'mon' : 'mon',
        'monday' : 'mon',
        'tu' : 'tue',
        'tue' : 'tue',
        'tuesday' : 'tue',
        'we' : 'wed',
        'wed' : 'wed',
        'wednesday' : 'wed',
        'th' : 'thu',
        'thu' : 'thu',
        'thursday' : 'thu',
        'fr' : 'fri',
        'fri' : 'fri',
        'friday' : 'fri',
        'sa' : 'sat',
        'sat' : 'sat',
        'saturday' : 'sat',
    };
    
    var DayNamesByNumber = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    
    var MonthNames = {
        'jan' : 1,
        'january' : 1,
        'feb' : 2,
        'february' : 2,
        'mar' : 3,
        'march' : 3,
        'apr' : 4,
        'april' : 4,
        'may' : 5,
        'jun' : 6,
        'june' : 6,
        'jul' : 7,
        'july' : 7,
        'aug' : 8,
        'august' : 8,
        'sep' : 9,
        'september' : 9,
        'oct' : 10,
        'october' : 10,
        'nov' : 11,
        'november' : 11,
        'dec' : 12,
        'december' : 12,
    };
    
    var OrdinalIndicators = ['st', 'nd', 'rd', 'th'];

    var DateObjKind = {
        date: "date",
        dateTime: "dateTime"
    };
    

    ////////////////////////////////////////////////////////////////////////////
    // Polyfils for Jumper

    if (!Array.prototype.find) {
        Array.prototype.find = Array.prototype.firstOrDefault;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Utility functions
    
    function assert(condition, message) {
        if(!condition) {
            throw new Error("Assertion failure: " + message);
        }
    }

    // Convert an instance of our internal dateTime representation to a JS Date object.
    // We also add an additional property named "kind", which has the value "date" or 
    // "dateTime", to indicate whether the time portion of the object is relevant to
    // its meaning.
    function toDateObj(dateTime, useUtc) {

        // Seems silly to have to write out 4 explicit factory functions, but 
        // more "clever" solutions didn't work.
        function localDateFactory(year, month, day) { return new Date(year, month, day); }
        function utcDateFactory(year, month, day) { return new Date(Date.UTC(year, month, day)); }
        function localDateTimeFactory(year, month, day, hour, min) { return new Date(year, month, day, hour, min); }
        function utcDateTimeFactory(year, month, day, hour, min) { return new Date(Date.UTC(year, month, day, hour, min)); }

        var d;
        if(dateTime.hour) {
        
            d = (useUtc ? utcDateTimeFactory : localDateTimeFactory)(
                parseInt(dateTime.year),
                parseInt(dateTime.month) - 1,
                parseInt(dateTime.day),
                parseInt(dateTime.hour),
                parseInt(dateTime.minute)
            );
            d.kind = DateObjKind.dateTime;
        } else {

            d = (useUtc ? localDateFactory : localDateFactory)(
                parseInt(dateTime.year),
                parseInt(dateTime.month) - 1,
                parseInt(dateTime.day)
            );
            d.kind = DateObjKind.date;
        }
        return d;
    }
    
    // Formats a JS Date object as an ISO date/time string.
    // Unlike the built in toISOString() function, this function will
    // take into account the "kind" property, and can output either UTC
    // or local time.
    function formatIso(dateObj, useUtc) {
    
        function pad(number) {
            return (number < 10) ? ('0' + number) : number;
        }
        
        function formatTimezoneOffset() {
            var offsetTotalMins = dateObj.getTimezoneOffset();
            
            // Note that sign is inverse of what you'd expect.
            var sign = offsetTotalMins > 0 ? '-' : '+';
            offsetTotalMins = (offsetTotalMins > 0) ? offsetTotalMins : 0 - offsetTotalMins;
            
            var hours = ~~(offsetTotalMins / 60);
            var mins = offsetTotalMins %60;
        
            return sign + pad(hours) + pad(mins);
        }

        var v = {
            year: useUtc ? dateObj.getUTCFullYear() : dateObj.getFullYear(),
            month: useUtc ? dateObj.getUTCMonth() : dateObj.getMonth(),
            day: useUtc ? dateObj.getUTCDate() : dateObj.getDate()
        };

        if(dateObj.kind == DateObjKind.dateTime) {
            v.hour = useUtc ? dateObj.getUTCHours() : dateObj.getHours();
            v.min = useUtc ? dateObj.getUTCMinutes() : dateObj.getMinutes();
        }

        var result = v.year +
            '-' + pad(v.month + 1) +
            '-' + pad(v.day);
    
        // Append time portion if applicable
        if(dateObj.kind === DateObjKind.dateTime) {
            result +=
                'T' + pad(v.hour) +
                ':' + pad(v.min) +
                ':' + "00";
            
            result += useUtc ? 'Z' : formatTimezoneOffset();
        }
    
        return result;
    }
    
    ////////////////////////////////////////////////////////////////////////////
    // Parsing infrastructure
    
    // Creates a stream abstraction around the specified array or string, used
    // for lexing and parsing operations.
    //
    //      arr: an array or string
    //      pos: the current position of the stream
    function makeStream(arr, pos /* = 0 */) {
    
        pos = pos || 0;
    
        var isMatch = function(p, value) { 
            return typeof p === 'function' ? p(value) : p === value;
        };
    
        return {
            peek: function(i /* = 1 */) {
                return i ? arr[pos + i - 1] : arr[pos];
            },
            consume: function() {
                var x = this.peek();
                pos++;
                return x;
            },
            accept: function(p) {
                if (isMatch(p, this.peek())) {
                    this.consume();
                    return true;
                }
                return false;
            },
            expect: function(p){
                if (isMatch(p, this.peek())) {
                    return this.consume();
                }
                throw new Error("Unexpected token: " + this.peek());
            },
            clone: function() {
                return makeStream(arr, pos);
            },
            get position() {
                return pos;
            },
        };
    }
    
    // Converts the specified input string to an array of tokens.
    function lex(str) {
        var tokens = [];
        var input = makeStream(str.toLowerCase());
    
        var makeToken = function(type, value) {
            return {
                type: type,
                value: value,
                toString: function() {
                    return value;
                }
            }
        };
    
        var makeMultiCharToken = function(type, regex){
            var text = '';
            while(input.peek() && regex.test(input.peek()))
                 text += input.consume();
            return makeToken(type, text);
        };
    
        var nextToken = function() {
            var c = input.peek();
            if(/[a-z]/i.test(c)) return makeMultiCharToken(TokenType.word, /[a-z]/i);
            if(/\d/.test(c)) return makeMultiCharToken(TokenType.number, /\d/);
            if(/[-\/\.\:\@]/.test(c)) return makeToken(TokenType.punct, input.consume());
            if(/\s/.test(c)) return makeMultiCharToken(TokenType.whitespace, /\s/);
            return makeToken(TokenType.other, input.consume());
        };
    
        while(input.peek()) {
            tokens.push(nextToken());
        }
        return tokens;
    }
    
    function isNumberToken(token, min, max) {
        if(!token)
            return false;
    
        if(token.type != TokenType.number)
            return false;
    
        var v = parseInt(token.value);
        if(min !== undefined && v < min)
            return false;
    
        if(max !== undefined && v > max)
            return false;
    
        return true;
    }
    
    function isDotToken(token) {
        return token && token.type === TokenType.punct && token.value === '.';
    }
    
    function isWordToken(token, value){
        return token && token.type === TokenType.word && token.value === value;
    }
    
    function makeAstNode(type, value, tokenArr, nodes /* = [] */) {
        return {
            type: type,
            value: value,
            tokens: tokenArr,
            nodes: nodes || []
        };
    }
    
    ////////////////////////////////////////////////////////////////////////////
    // Below we define a set of parser functions, and parser factory functions
    // (combinators) that combine parser functions to form more complex parsers.
    // All parser functions have the signature
    //
    //      function p(ts) : [ { ast, ts }, { ast, ts }, ... ]
    //
    // That is, the function accepts a 'ts' argument representing the input
    // token stream, and returns an array of AST-tokenStream pairs. The array
    // represents the set of possible ASTs produced from the input token stream.
    // Paired with each AST is a tokenStream object positioned immediately after
    // the last token consumed for that AST.
    //
    // The reason that these parsers return a set of ASTs, as opposed to a
    // single AST, is that date-time phrases tend to be ambiguous by nature, and
    // thus we assume that there may be multiple valid interpretations of a
    // given phrase. The approach taken here is to generate all possible ASTs,
    // and then attempt to choose the "best" based on some criteria.
    //
    // The parser is expected to throw an Error if parsing fails on given
    // input token stream. A parser should generally NOT return an empty array
    // (although there is one exception - see "optional" combinator below).
    
    // Define the set of primitive parsers i.e. these each produce a single
    // AST leaf node. 
    var primitives = {
    
        dayOfWeek: function(ts) {
            var token = ts.expect(function(t) {
                return t.type == TokenType.word && DayNames[t.value];
            });
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.dayOfWeek, DayNames[token.value], [token])
            }];
        },
        relativeDay: function(ts) {
            var values = ["today", "tomorrow"];
            var token = ts.expect(function(t) { 
                return t.type == TokenType.word && values.indexOf(t.value) > -1;
            });
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.relativeDay, token.value, [token])
            }];
        },
        day: function(ts) {
            var numberToken = ts.expect(function(t) { return isNumberToken(t, 1, 31); });
    
            // Check if there's an ordinal indicator, and if so, consume it.
            var nextToken = ts.peek();
            if(nextToken && nextToken.type == TokenType.word
                 && OrdinalIndicators.indexOf(nextToken.value) > -1) {
                ts.consume();
                return [{
                    ts: ts,
                    ast: makeAstNode(AstNodeType.day, numberToken.value, [numberToken, nextToken])
                }];
            }
    
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.day, numberToken.value, [numberToken])
            }];
        },
        month: function(ts) {
            // Is it a month name?
            var token = ts.peek();
            if(token.type == TokenType.word && MonthNames[token.value]) {
                ts.consume();
                return [{
                    ts: ts,
                    ast: makeAstNode(AstNodeType.month, MonthNames[token.value].toString(), [token])
                }];
            }
    
            // Expect a month number.
            var token = ts.expect(function(t) { return isNumberToken(t, 1, 12); });
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.month, token.value, [token])
            }];
        },
        year: function(ts){
            var token = ts.expect(function(t) { 
                return isNumberToken(t) && (t.value.length === 2 || t.value.length === 4);
            });
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.year, token.value, [token])
            }];
        },
        hour: function(ts){
            var token = ts.expect(function(t) { return isNumberToken(t, 0, 23); });
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.hour, token.value, [token])
            }];
        },
        minute: function(ts){
            var token = ts.expect(function(t) { return isNumberToken(t, 0, 59); });
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.minute, token.value, [token])
            }];
        },
        meridiem: function(ts) {
            var prefixes = ['a', 'am', 'p', 'pm'];
    
            var token = ts.expect(function(t){
                return t.type == TokenType.word && prefixes.indexOf(t.value) > -1;
            });
    
            var consumed = [token];
            if(token.value == 'a' || token.value == 'p') {
                // Consume the .m., if it exists...
                if(isDotToken(ts.peek(1))
                    && isWordToken(ts.peek(2), 'm')){
                    consumed.push(ts.consume()); // .
                    consumed.push(ts.consume()); // m
    
                    if(isDotToken(ts.peek()))
                        consumed.push(ts.consume()); // .
                }
            }
    
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.meridiem, token.value[0] == 'a' ? "am" : "pm", consumed)
            }];
        },
    
        datePartSeparator: function(ts){
            var values = ['-', '.', '/'];
            var token = ts.expect(function(t) { 
                return t.type == TokenType.punct && values.indexOf(t.value) >-1;
            });
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.datePartSeparator, token.value, [token])
            }];
        },
        hourMinuteSeparator: function(ts){
            var values = [':', '.'];
            var token = ts.expect(function(t) { 
                return t.type == TokenType.punct && values.indexOf(t.value) >-1;
            });
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.hourMinuteSeparator, token.value, [token])
            }];
        },
        dateTimeSeparator: function(ts){
            var values = ['@', 'at', 'from'];
    
            var token = ts.expect(function(t) { 
                return (t.type == TokenType.punct || t.type == TokenType.word)
                    && values.indexOf(t.value) > -1;
            });
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.dateTimeSeparator, token.value, [token])
            }];
        },
        timeDateSeparator: function(ts){
            var values = ['on', 'from'];
    
            var token = ts.expect(function(t) { 
                return (t.type == TokenType.punct || t.type == TokenType.word)
                    && values.indexOf(t.value) > -1;
            });
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.timeDateSeparator, token.value, [token])
            }];
        },
        rangeSeparator: function(ts) {
            var values = ['-', 'to', 'until', 'thru', 'through',
             '\u2013', // en-dash
            ];
    
            var token = ts.expect(function(t) { 
                return (t.type == TokenType.punct || t.type == TokenType.word)
                    && values.indexOf(t.value) > -1;
            });
            return [{
                ts: ts,
                ast: makeAstNode(AstNodeType.rangeSeparator, token.value, [token])
            }];
        },
    };

    // Define the set of parser combinators. These are parser factory functions
    // that each return a new parser function, typically based on a combination
    // of supplied parser functions.
    var combinators = {
        
        // Returns a parser that represents a set of parsers applied sequentially.
        // The returned parser succeeds only if all element-parsers succeed.
        sequence: function(astNodeType, elements) {
            assert(Array.isArray(elements) && elements.length > 0,
                "Expected at least one element in sequence.");
                
            var applyElementToPath = function(path, element) {
                var results = element(path.ts.clone());
                
                if(results.length <= 0 ) { // i.e. "optional" was not present
                    return [path]; // This path is unchanged
                }
                
                return results.map(function(result) {
                    return {
                        astSequence: path.astSequence.concat(result.ast),
                        ts: result.ts
                    };
                });
            };
                
            return function(ts) {
                var paths = []; // array of { astSequence: [ast1, ast2, ...], ts: tokenStream }
                paths.push({ astSequence: [], ts: ts }); // seed with empty sequence
                
                for(var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    var pathCount = paths.length;
                    for(var p = 0; p < pathCount; p++) {
                        try {
                            var newPaths = applyElementToPath(paths[p], element);
                            Array.prototype.push.apply(paths, newPaths);
                        } catch(e) {
                            // This path failed, so it can be pruned from the set
                        }
                    }
                    
                    // remove the paths we just processed
                    paths.splice(0, pathCount);
                    
                    if(paths.length <= 0) // all paths failed?
                        throw new Error("Input does not match expected format.");
                }
                
                assert(paths.length > 0, "Expected at least one path succeeded");
                
                return paths.map(function(path) {
                    return {
                        ts: path.ts,
                        ast: makeAstNode(astNodeType, null, null, path.astSequence)
                    };
                });
            };
        },

        // Returns a parser that represents the option of applying a specified 
        // parser. The returned parser always succeeds, but returns an empty
        // array in the case where the optional content was not present in the
        // input stream.
        optional: function(element) {
            return function(ts) {
                try {
                    // clone the token stream so that if we end up in the catch
                    // clause, the original stream position is unchanged
                    return element(ts.clone());
                } catch(e) {
                    return []; // signals that the optional tokens were not present
                }
            };
        },

        // Returns a parser that represents a set of parsers applied in parallel.
        // The returned parser returns the value of the first parser to succeed.
        // If no parser succeeds, it throws an Error.
        first: function(elements) {
            return function(ts) {
                var error;
                for(var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    try {
                        return element(ts.clone());
                    } catch(e) {
                        // Capture the first error, in case we need
                        // to rethrow something below.
                        //if(!error) error = e;
                        error = e;
                    }
                }
                assert(!!error, "Expected an error.");
                throw new Error("Input does not match any expected format.");
            };
        },
        
        // Returns a parser that represents a set of parsers applied in parallel.
        // The returned parser returns the union of the results of all successful
        // parsers.
        // If no parser succeeds, it throws an Error.
        all: function(elements) {
            return function(ts) {
                var errorCount = 0;
                var results = [];
                for(var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    try {
                        var result = element(ts.clone());
                        Array.prototype.push.apply(results, result);
                    } catch(e) {
                        errorCount++;
                    }
                }
                
                // If none of the alternatives succeeded, it's an error
                if(errorCount >= elements.length) {
                    throw new Error("Input does not match any expected format.");
                }
                
                return results;
            };
        }
    };
    
    ///////////////////////////////////////////////////////////////////////////
    // Here we effectively define the grammar by using the combinator functions
    // to combine primitive parser functions into more complex parser functions
    // that encode possible interpretations of the input token stream.
    
    // Define shorthand aliases for primitives and combinators,
    // to make them easier to work with.
    var DW = primitives.dayOfWeek,
        DR = primitives.relativeDay,
        DM = primitives.day,
        MO = primitives.month,
        YR = primitives.year,
        H = primitives.hour,
        M = primitives.minute,
        U = primitives.meridiem,
        DPS = primitives.datePartSeparator,
        HMS = primitives.hourMinuteSeparator,
        RS = primitives.rangeSeparator,
        DTS = primitives.dateTimeSeparator,
        TDS = primitives.timeDateSeparator,
        
        SEQ = combinators.sequence,
        
        // Assign either 'first' or 'all' depending on desired behaviour.
        // 'first' will result in a faster but less capable parser.
        // 'all' will result in a slower parser, but one that is more likely
        // to produce a good result.
        ALT = combinators.all,
        
        // Be careful with the use of OPT! Unlike ALT, it does not produce 
        // alternatives, and thus should not be used where there may be any
        // ambiguity as to the meaning of the optional content. For example,
        // consider something like:
        //    SEQ(AstNodeType.dateTime,
        //      SEQ(AstNodeType.date, [MO, DM, OPT(YR)]),
        //      SEQ(AstNodeType.time, [H, HMS, M, OPT(U)])
        //    )
        //
        // When given the input
        //      May 15 12:30 pm
        // the OPT(YR) will consume the token '12', interpreting it as a 2-digit
        // year, causing the parser to fail.
        // Instead, this grammar should be expressed in terms of explicit
        // alternatives, i.e. 
        //
        //    SEQ(AstNodeType.dateTime,
        //      ALT(
        //          SEQ(AstNodeType.date, [MO, DM, YR)]),
        //          SEQ(AstNodeType.date, [MO, DM])
        //      )
        //      SEQ(AstNodeType.time, [H, HMS, M, OPT(U)])
        //    )
        //
        // When expressed in this way, both alternatives are evaluated, thus
        // allowing the parser to succeed (via the 2nd alternative).
        // In contrast, the OPT(U) does not pose any problem, because there
        // is no potential for ambiguity as to the meaning of the 'pm' token.
        OPT = combinators.optional;
        
    
    // Define higher-level constructs using combinations of primitives.
    // Note that when using ALT, order matters insofar as alternatives
    // that appear earlier in the list are more likely to be selected as "best",
    // all other things being equal. This is particularly relevant with ambiguous
    // phrases like
    //      08/10/24
    // which could be interpreted as any of
    //      Aug 10 2024
    //      Oct 8 2024
    //      Oct 24 2008
    
    var DATE = ALT([
        SEQ(AstNodeType.date, [YR, OPT(DPS), MO, OPT(DPS), DM]),
        SEQ(AstNodeType.date, [MO, DPS, DM, DPS, YR]),
        SEQ(AstNodeType.date, [DM, DPS, MO, DPS, YR]),
        SEQ(AstNodeType.date, [MO, DPS, DM]),
        SEQ(AstNodeType.date, [DM, DPS, MO]),
        SEQ(AstNodeType.date, [OPT(DW), MO, DM, YR]),
        SEQ(AstNodeType.date, [OPT(DW), MO, DM]),
        SEQ(AstNodeType.date, [OPT(DW), DM, MO, YR]),
        SEQ(AstNodeType.date, [OPT(DW), DM, MO]),
        SEQ(AstNodeType.date, [DW]),
        SEQ(AstNodeType.date, [DR]),
    ]);
    
    var DATERANGE = ALT([
        SEQ(AstNodeType.dateRange, [DATE, RS, DATE]),
        SEQ(AstNodeType.dateRange, [MO, DM, RS, DM, YR]),
        SEQ(AstNodeType.dateRange, [MO, DM, RS, DM]),
        SEQ(AstNodeType.dateRange, [DM, RS, DM, MO, YR]),
        SEQ(AstNodeType.dateRange, [DM, RS, DM, MO]),
    ]);
    
    var TIME = ALT([
        SEQ(AstNodeType.time, [H, HMS, M, OPT(U)]),
        SEQ(AstNodeType.time, [H, OPT(U)]),
    ]);
    
    var TIMERANGE = ALT([
        SEQ(AstNodeType.timeRange, [TIME, RS, TIME])
    ]);
    
    var DATETIME = ALT([
        SEQ(AstNodeType.dateTime, [DATE, OPT(DTS), TIME]),
        SEQ(AstNodeType.dateTime, [TIME, OPT(TDS), DATE]),
    ]);

    var DATETIMERANGE = ALT([
        SEQ(AstNodeType.dateTimeRange, [DATETIME, RS, DATETIME])
    ]);
    
    var PHRASE = ALT([
        SEQ(AstNodeType.phrase, [DATETIMERANGE]),
        SEQ(AstNodeType.phrase, [DATERANGE, OPT(DTS), TIMERANGE]),
        SEQ(AstNodeType.phrase, [TIMERANGE, OPT(TDS), DATERANGE]),
        SEQ(AstNodeType.phrase, [DATE, OPT(DTS), TIMERANGE]),
        SEQ(AstNodeType.phrase, [TIMERANGE, OPT(TDS), DATE]),
        SEQ(AstNodeType.phrase, [DATERANGE, OPT(DTS), TIME]),
        SEQ(AstNodeType.phrase, [TIME, OPT(TDS), DATERANGE]),
        SEQ(AstNodeType.phrase, [DATERANGE]),
        SEQ(AstNodeType.phrase, [DATETIME]),
        SEQ(AstNodeType.phrase, [DATE]),
    ]);
    
    /// Extract the value represented by the specified AST node.
    //
    //      astNode: the AST node,
    //      returns: an object representing the value of the node.
    //          If the node is a primitive, the value will be a string.
    //          Otherwise, the value will be an object with properties that depend on the node type.
    function extractValue(astNode) {
    
        var getNode = function(parentNode, type, converter) {
            var node = parentNode.nodes.find(function(n){ return n.type === type; });
            if(!node) return undefined;
            return converter ? converter(node) : node;
        };
    
        var getRangeNodePair = function(parentNode, type, converter) {
            var childNodes = parentNode.nodes.filter(function(n) { return n.type == type; });
            return converter ? childNodes.map(converter) : childNodes;
        };
    
        var mix = function(a, b) {
            var result = {};
            for(var k in a) result[k] = a[k];
            for(var k in b) result[k] = b[k];
            return result;
        };

        var addDays = function(dateTime, numberOfDays) {
            if(numberOfDays == 0) return dateTime;

            var dateObj = toDateObj(dateTime);
            dateObj.setDate(dateObj.getDate() + numberOfDays);
            var iso = formatIso(dateObj);
            return {
                year: iso.substr(0, 4),
                month: iso.substr(5, 2),
                day: iso.substr(8, 2)
            };
        };
        
        var fromDateObj = function(dateObj){ 
            return {
                year: dateObj.getFullYear().toString(),
                month: (dateObj.getMonth() + 1).toString(),
                day: dateObj.getDate().toString()
            };
        };
        
        var currentDate = function() {
            return fromDateObj(new Date());
        };
    
        var extractPrimitive = function(node) {
            return node.value;
        };
    
        var extractDate = function(dateNode, partial /* = false*/) {
    
            // There are 3 cases:
            // 1. The day-of-month is specified.
            // 2. A relative day ("today", "tomorrow") is specified.
            // 3. The day-of-week is specified.
            var day = getNode(dateNode, AstNodeType.day, extractPrimitive);
    
            // Case 1: day-of-month is specified.
            if(day) {
                // Determine month and year.
                var month = getNode(dateNode, AstNodeType.month, extractPrimitive);
                var year = getNode(dateNode, AstNodeType.year, extractPrimitive);
                
                // If 'partial' is not specified and there is missing information,
                // default the missing information to current date.
                if(!partial && (!month || !year)) {
                    var today = currentDate();
                    month = month || today.month;
                    year = year || today.year;
                }
                
                // If a two-digit year was supplied, convert it to a 4-digit year.
                if(year && year.length === 2) {
                    // hardcode "20" (assuming this code won't survive into the 22nd century...)
                    year = "20" + year;
                }
                
                return {
                    year: year,
                    month: month,
                    day: day
                };
            }
    
            // Case 2: relative day is specified
            var relativeDay = getNode(dateNode, AstNodeType.relativeDay, extractPrimitive);
            if(relativeDay) {
                var theDay = new Date();
                if(relativeDay == "tomorrow")
                    theDay.setDate(theDay.getDate() + 1);
    
                // Take all values based on the selected date.
                return fromDateObj(theDay);
            }
    
            // Case 3: day-of-week is specified.
            var dayOfWeek = getNode(dateNode, AstNodeType.dayOfWeek, extractPrimitive);
            if(dayOfWeek) {
                // Surely there's a better way to do this...
                var theDay = new Date();
                while(DayNamesByNumber[theDay.getDay()] !== dayOfWeek) {
                    theDay.setDate(theDay.getDate() + 1);
                }
    
                // Take all values based on the selected date.
                return fromDateObj(theDay);
            }    
    
            assert(false, "Expected either 'day' or 'dayOfWeek' to be specified.");
        };
    
        var extractTime = function(timeNode, defaultMeridiem/*= undefined */) {
            var hour = getNode(timeNode, AstNodeType.hour, extractPrimitive);
            assert(!!hour, "Expected 'time' node to always have an 'hour'.");
    
            // Convert hour to 24-hr format
            var u = getNode(timeNode, AstNodeType.meridiem, extractPrimitive)
                || defaultMeridiem;
                
            if(u) {
                var h = parseInt(hour);
                if(u === "pm") {
                    hour = (h < 12 ? (h + 12) : h).toString();
                } else if(u === "am") {
                    hour = (h === 12 ? 0 : h).toString();
                }
            }
    
            var min = getNode(timeNode, AstNodeType.minute, extractPrimitive) || "00";
            return {
                hour: hour,
                minute: min
            };
        };
    
        var extractDateTime = function(dtNode, partialDate /* = false*/) {
            var date = getNode(dtNode, AstNodeType.date, 
                function(node) { return extractDate(node, partialDate); });
                
            assert(!!date, "Expected 'dateTime' node to always have a 'date'.");
    
            var time = getNode(dtNode, AstNodeType.time, extractTime);
            assert(!!time, "Expected 'dateTime' node to always have a 'time'.");
            
            return mix(date, time);
        };
        
        // Fill in any missing year/month data in the specified 'start' and 'end'
        // dates. Modifies the arguments!
        var completePartialDatesInRange = function(start, end, refDate) {
            start.year = start.year || end.year || refDate.year;
            start.month = start.month || end.month || refDate.month;
            end.year = end.year || start.year || refDate.year;
            end.month = end.month || start.month || refDate.month;
        };
    
        var extractDateRange = function(drNode) {
            var today = currentDate();
            
            // Case 1: DATE RS DATE
            var dates = getRangeNodePair(drNode,  AstNodeType.date,
                function(dateNode) { return extractDate(dateNode, /*partial=*/true); });
            if(dates.length) {
                assert(dates.length === 2, "Expected 'dateRange' node to have start and end 'date' nodes.");
                
                var start = dates[0], end = dates[1];
                completePartialDatesInRange(start, end, today);
        
                return {
                    start: start,
                    end: end
                };
            }
    
            // Case 2:
            //  MO DM RS DM
            //  MO DM RS DM[,] YR
            var year = getNode(drNode, AstNodeType.year, extractPrimitive) || today.year;
            var month = getNode(drNode, AstNodeType.month, extractPrimitive) || today.month;
    
            var days = getRangeNodePair(drNode,  AstNodeType.day, extractPrimitive);
            assert(days.length === 2, "Expected 'dateRange' node to have a start and end 'day' nodes.");
    
            return {
                start: {
                    year: year,
                    month: month,
                    day: days[0]
                },
                end: {
                    year: year,
                    month: month,
                    day: days[1]
                }
            };
        };
    
        var extractTimeRange = function(trNode) {
            var timeNodes = getRangeNodePair(trNode,  AstNodeType.time);
            assert(timeNodes.length === 2, "Expected 'timeRange' node to have start and end 'time' nodes.");
            
            // In order to handle cases like "2 - 4 pm", we extract the end time first and then
            // use it to infer a missing meridiem specifier for the start time.
            var endTime = extractTime(timeNodes[1]);
            var startTime = extractTime(timeNodes[0], parseInt(endTime.hour) >= 12 ? "pm" : "am");
            
            var crossOver = parseInt(endTime.hour) < parseInt(startTime.hour);

            return {
                start: startTime,
                end: endTime,
                daySpan: crossOver ? 1 : 0
            };
        };
    
        var extractDateTimeRange = function(dtrNode) {
            var dateTimes = getRangeNodePair(dtrNode,  AstNodeType.dateTime,
                function(node) { return extractDateTime(node, /*partial=*/true); });
            assert(dateTimes.length === 2, "Expected 'dateTimeRange' node to have start and end 'dateTime' nodes.");
            
            var start = dateTimes[0], end = dateTimes[1];
            var today = currentDate();
            completePartialDatesInRange(start, end, today);
            
            return {
                start: start,
                end: end
            };
        };
    
        var extractEventFromDateNode = function(dateNode, phraseNode) {
            var date = extractDate(dateNode);
    
            // Is there also a time-range?
            var timeRange = getNode(phraseNode, AstNodeType.timeRange, extractTimeRange);
            if(timeRange) {
                return {
                    start: mix(date, timeRange.start),
                    end: mix(addDays(date, timeRange.daySpan), timeRange.end)
                }
            }
    
            return {
                start: date
            };
        };
        var extractEventFromDateTimeNode = function(dateTimeNode, phraseNode) {
            return {
                start: extractDateTime(dateTimeNode)
            };
        };
        var extractEventFromDateRangeNode = function(dateRangeNode, phraseNode) {
            var dateRange = extractDateRange(dateRangeNode);
    
            // Is there also a time-range?
            var timeRange = getNode(phraseNode, AstNodeType.timeRange, extractTimeRange);
            if(timeRange) {
                // Assume this is a multi-day recurring event w start/end time
                return {
                    start: mix(dateRange.start, timeRange.start),
                    end: mix(addDays(dateRange.start, timeRange.daySpan), timeRange.end),
                    recurDailyUntil: dateRange.end
                };
            }
    
            // ... or a time?
            var time = getNode(phraseNode, AstNodeType.time, extractTime);
            if(time) {
                // Assume this is a multiday recurring event w start time
                return {
                    start: mix(dateRange.start, time),
                    recurDailyUntil: dateRange.end
                };
            }
            
            return dateRange;
        };
        var extractEventFromDateTimeRangeNode = function(dateTimeRangeNode, phraseNode) {
            return extractDateTimeRange(dateTimeRangeNode);
        };
            
        var extractEvent = function(phraseNode) {
    
            var dateNode = getNode(phraseNode, AstNodeType.date);
            if(dateNode) {
                return extractEventFromDateNode(dateNode, phraseNode);
            }
    
            var dateTimeNode = getNode(phraseNode, AstNodeType.dateTime);
            if(dateTimeNode) {
                return extractEventFromDateTimeNode(dateTimeNode, phraseNode);
            }
    
            var dateRangeNode = getNode(phraseNode, AstNodeType.dateRange);
            if(dateRangeNode) {
                return extractEventFromDateRangeNode(dateRangeNode, phraseNode);
            }
            
            var dateTimeRangeNode = getNode(phraseNode, AstNodeType.dateTimeRange);
            if(dateTimeRangeNode) {
                return extractEventFromDateTimeRangeNode(dateTimeRangeNode, phraseNode);
            }
        };
    
        switch(astNode.type) {
            case AstNodeType.phrase: return extractEvent(astNode);
            case AstNodeType.date: return extractDate(astNode);
            case AstNodeType.dateRange: return extractDateRange(astNode);
            case AstNodeType.time: return extractTime(astNode);
            case AstNodeType.timeRange: return extractTimeRange(astNode);
            case AstNodeType.dateTime: return extractDateTime(astNode);
            case AstNodeType.dateTimeRange: return extractDateTimeRange(astNode);
            default: return extractPrimitive(astNode);
        }
    }
    
    function rankAsts(items) {
        // Sort ASTs according to how much of the input stream
        // was consumed. We use the heuristic that the "best" AST is the one that
        // consumed the largest number of input tokens (token stream has the largest
        // value for 'position' property), and sort items so that the best
        // AST appears first.
        return items
            .map(function(item) {
                var ast = item.ast;
                ast.score = item.ts.position; // attach a 'score' to AST root
                return ast;
            }).toSorted(function(a, b) { 
                return b.score - a.score;
            });
    }
    
    function printAst(ast, indent) {
        print(indent + AstNodeType.format(ast.type) + ": " + (ast.value || ""));
        ast.nodes.forEach(function(node){
            printAst(node, indent + '\t');
        });
    }
    
    /// Parse the specified string and return the set of possible ASTs.
    //      str: the string to parse.
    //      returns: array of AST roots, ordered from best to worst.
    function getMultiAst(str, options) {
        options = options || {};
    
        var tokens = lex(str);
        
        // Remove insignificant tokens.
        tokens = tokens.filter(function(t){
            return t.type != TokenType.whitespace
                && t.type != TokenType.other;
        });
        
        var ts = makeStream(tokens);
        return rankAsts((options.parseAs || PHRASE)(ts));
    }
    
    /// Parse the specified string and return the AST.
    //      str: the string to parse.
    function getAst(str, options) {
        var asts = getMultiAst(str, options);
        
        // If there was a tie, the input was ambiguous
        if(asts.length > 1 && (asts[0].score === asts[1].score)
            && (!options || !options.ambiguityHandling || options.ambiguityHandling === 'throw'))
            throw new Error("Ambiguous input format.");
        
        return asts[0];
    }
    
    /// Pretty print the AST.
    //      strOrAst: the AST, or string to parse.
    function showAst(strOrAst, options) {
        if(typeof strOrAst === 'string') {
            strOrAst = getAst(strOrAst, options);
        }
        printAst(strOrAst, "");
    }
    
    /// Pretty print all ASTs.
    //      str: the string to parse.
    function showMultiAst(str, options) {
        var asts = getMultiAst(str, options);
        asts.forEach(function(ast, i) {
            print("AST #" + (i + 1));
            printAst(ast, "");
            print("");
        });            
    }
    
    /// Parse the specified string and return an object representing the event
    /// date and time characteristics.
    //
    //      str: the string to parse.
    //      options: {
    //          parseAs: one of the values from the parseAs enumeration - specifies how to 
    //              interpret the input text.
    //          utc: bool - specifies that values should be interpreted as UTC instead of local.
    //          ambiguityHandling: 'throw'|'first' - specifies what to do with ambiguous input.
    //              Use 'throw' to throw an error (this is the default); use 'first' to return
    //              the first of the possible interpretations.
    //      }
    //      returns: {
    //          start: a Date object representing the start date/time.
    //          end: a Date object representing the end date/time (if applicable),
    //          recurDailyUntil: a Date object representing the recurrence end date (if applicable)
    //      }
    function parse(str, options) {
        options = options || {};
    
        var ast = getAst(str, options);
        var value = extractValue(ast);

        var result = {
            start: value.start ? toDateObj(value.start, options.utc) : undefined,
            end: value.end ? toDateObj(value.end, options.utc) : undefined,
            recurDailyUntil: value.recurDailyUntil ? toDateObj(value.recurDailyUntil, options.utc) : undefined,
        };

        result.toString = function() {
            var parts = [];
            if(result.start) parts.push("start=" + formatIso(result.start, options.utc));
            if(result.end) parts.push("end=" + formatIso(result.end, options.utc));
            if(result.recurDailyUntil) parts.push("recurDailyUntil=" + formatIso(result.recurDailyUntil, options.utc));

            return parts.join(", ");
        };

        return result;
    }

    // Exports
    return {
        parse: parse,
        
        parseAs: {
            DATE: DATE,
            TIME: TIME,
            DATETIME: DATETIME,
            DATERANGE: DATERANGE,
            TIMERANGE: TIMERANGE,
            DATETIMERANGE: DATETIMERANGE,
            PHRASE: PHRASE
        },
        
        dbg: {
            getAst: getAst,
            getMultiAst: getMultiAst,
            showAst: showAst,
            showMultiAst: showMultiAst,
            extractValue: extractValue,
        }
    };
}));