"use strict";
var Base64x64 = require('./Base64x64');
var Stamp = require('./Stamp');

/**  Swarm is based on the Lamport model of time and events in a
 * distributed system, so Lamport logical timestamps are essential
 * to its functioning. Still, in most of the cases, it is useful
 * to know the actual wall clock time of an event.
 * Hence, we use logical timestamps that match the wall clock time
 * numerically. A similar approach was termed "hybrid timestamps"
 * in http://www.cse.buffalo.edu/tech-reports/2014-04.pdf.
 * Unfortunately, we can not rely on client-side NTP, so our
 * approach differs in some subtle but critical ways.
 * The correct Swarm time is mostly dictated from upstream
 * to downstream replicas, recursively. We only expect
 * local clocks to have some reasonable skew, so replicas can
 * produce correct timestamps while being offline (temporarily).
 *
 * Again, this is logical clock that tries to be as close to
 * wall clock as possible, so downstream replicas may
 * intentionally lag behind the astronomic time a little bit just
 * to ensure they don't run ahead. The magnitude of such effects
 * is bounded by RTT (round trip time).
 *
 * The format of a timestamp is calendar-friendly.
 * Separate base64 characters denote UTC month (since Jan 2010),
 * date, hour, minute, second and millisecond, plus three base64
 * chars for a sequence number: `MMDHmSssiii`. Every base64 char is
 * 6 bits, but date (1-31) and hour (0-23) chars waste 1 bit each,
 * so a timestamp has 64 meaningful bits in 11 base64 chars.
 *
 * We don't always need full 11 chars of a timestamp, so the class
 * produces Lamport timestamps of adaptable length, 5 to 11 chars,
 * depending on the actual event frequency. For the goals of
 * comparison, missing chars are interpreted as zeros.
 * The alphanumeric order of timestamps is correct, thanks to
 * our custom version of base64 (01...89AB...YZ_ab...yz~).
 *
 * @class
 * @param now
 * @param options
 */
class Clock {

    constructor (now, options) {
        if (typeof(now)==="string") {
            now = new Stamp(now);
        }
        this._last = now;
        this._origin = now.origin;
        this._offset = 0;
        this._minlen = 6;
        if (options) {
            if (options.minLength) {
                this._minlen = options.minLength;
            }
            if (options.learnOffset) {
                let my_now = Base64x64.now();
                this._offset = now.Value.ms - my_now.ms;
            } else if (options.offset) {
                this._offset = options.offset|0;
            }
        }
    }


    issueTimestamp () {
        var next = Stamp.now(this._origin, this._offset);
        var last = this._last;
        if (!next.gt(last)) {// either seq++ or stuck-ahead :(
            next = last.next(this._origin);
        } else if (this._minlen<8) { // shorten?
            next = new Stamp (
                next.Value.relax(last.value, this._minlen),
                this._origin
            );
        }
        this._last = next;
        return next;
    }

    seeTimestamp (stamp) {
        stamp = Stamp.as(stamp);
        if (stamp.gt(this._last)) {
            this._last = stamp;
        }
    }

}

module.exports = Clock;
