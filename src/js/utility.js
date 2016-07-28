/** @namespace */
var Utility = {};

(function() {


    /**
     * Converts an unsigned integer into an array of
     * binary numbers.
     * @memberof Utility
     *
     * @param {Number} num - the unsigned integer to be converted.
     * @param {Number} padding - how many zeros to pad integer.
     * @returns {Array} the binary array representation of unsigned integer.
     */
    Utility.uintToBinArray = function(num, padding) {
        var bin_array = [];
        while(num > 0) {
            bin_array.push(num & 1);
            num >>= 1;
        }

        if(typeof padding !== "undefined") {
            padding -= bin_array.length;

            while(padding > 0) {
                bin_array.push(0);
                padding -= 1;
            }
        }

        bin_array.reverse();

        return bin_array;
    };


    /**
     * Converts signed integer into unsigned integer.
     * @memberof Utility
     *
     * @param  {Number} int  - The signed integer to be converted.
     * @param  {Number} nbit - (optional) the number of bits the integer takes.
     * @return {Number}      The unsigned integer representation of signed
     * integer.
     */
    Utility.intToUint = function(int, nbit) {
        var u = new Uint32Array(1);
        nbit = +nbit || 16;
        if (nbit > 32) throw new RangeError('intToUint only supports ints up to 32 bits');
        u[0] = int;
        if (nbit < 32) { // don't accidentally sign again
            int = Math.pow(2, nbit) - 1;
            return u[0] & int;
        } else {
            return u[0];
        }
    };


    /**
     * Converts unsigned integer into signed integer.
     * @memberof Utility
     *
     * @param  {Number} uint - The unsigned integer to be converted.
     * @param  {Number} nbit - (optional) the number of bits the integer takes.
     * @return {Number}      The signed integer representation of unsigned
     * integer.
     */
    Utility.uintToInt = function(uint, nbit) {
        nbit = +nbit || 16;
        if (nbit > 32) throw new RangeError('uintToInt only supports ints up to 32 bits');
        uint <<= 32 - nbit;
        uint >>= 32 - nbit;
        return uint;
    };


    /**
     * Converts decimal value into hexadecimal string.
     * @memberof Utility
     *
     * @param  {Number} num    - The value to be converted.
     * @param  {Number} digits - (optional) how many hexadecimal digits there
     * are (used for padding and truncating)
     * @return {String} The hexadecimal representation.
     */
    Utility.hex = function(num, digits) {
        digits = digits || 4;
        var s = (num >>> 0).toString(16).toUpperCase();
        var padleft = digits - s.length;
        if(padleft < 0) {
            padleft = 0;
            s = s.substr(s.length - digits, digits);
        }

        s = new Array(padleft + 1).join("0") + s;

        return s;
    };
}());
