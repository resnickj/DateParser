# DateParser

A JavaScript library for parsing colloquial date/time and date/time range
strings


## Summary

This library began as an experiment in the use of parser combinators as a 
technique for coping with the variety and ambiguity of natural date/time and
date/time range strings found in the wild. The idea was to define a set of 
elemental parsers for the various elements of date/time phrases - year, month,
day, hour, minute, etc.- and then use combinator functions to define parsers
representing all of the various ways that these elements might be combined to
form a phrase representing a date/time or date/time range.


## Examples

The following are examples of the types of phrases that the parser can
understand.

### A single date
* Aug 24th 2017

### A single date and time
* August 24 2017 at 8 pm
* Tomorrow 8pm

### A single date and a time range
* August 24 2017 8:00 - 10:00 pm

### A date+time range
* May 27 5pm - May 30 12pm

### A date range and a single time (recurring event)
* Aug 28th-29th @ 5pm

### A date range and a time range (recurring event)
* May 27 - December 31 from 12:00 PM - 5:00 PM
