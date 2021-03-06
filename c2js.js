/**
 * I wrote this script to help me porting a C application to JavaScript.
 * I decided to use several regexp replacements rather than a parser.
 * The set of regexp is very limited and developed for a particular project
 * in mind, as such I strongly recommend against its use.
 *
 * @todo Things to implement:
 *  * Transform 'static' to 'var/const'.
 */

var util = require('util'),
    fs = require('fs'),
    file = process.argv[2],
    cSource = fs.readFileSync(file, 'utf-8');


/**
 * List of reserved keywords in C.
 * @const
 */
var reservedKeywords = [
  'auto',
  'break',
  'case',
  //'char',
  'const',
  'continue',
  'default',
  'do',
  //'double',
  'else',
  'enum',
  'extern',
  //'float',
  'for',
  'goto',
  'if',
  //'int',
  //'long',
  'register',
  'return',
  //'short',
  //'signed',
  'sizeof',
  'static',
  'struct',
  'switch',
  'typedef',
  'union',
  //'unsigned',
  //'void',
  'volatile',
  'while',

  'printf'
];


/**
 * Mapping of C types to JavaScript primitives.
 * @const
 */
var cTypesToJs = {
  // Fix width integer types
  'uint8_t': 'number',
  'uint16_t': 'number',
  'uint32_t': 'number',
  'uint64_t': 'number',
  'int8_t': 'number',
  'int16_t': 'number',
  'int32_t': 'number',
  'int64_t': 'number',

  // Basic types
  'unsigned long long int': 'number',
  'signed long long int': 'number',
  'unsigned short int': 'number',
  'unsigned long long': 'number',
  'unsigned long int': 'number',
  'signed short int': 'number',
  'signed long long': 'number',
  'signed long int': 'number',
  'unsigned short': 'number',
  'unsigned char': 'string',
  'unsigned long': 'number',
  'long long int': 'number',
  'signed short': 'number',
  'unsigned int': 'number',
  'signed char': 'string',
  'signed long': 'number',
  'long double': 'number',
  'signed int': 'number',
  'short int': 'number',
  'long long': 'number',
  'unsigned': 'number',
  'long int': 'number',
  'double': 'number',
  'short': 'number',
  'float': 'number',
  'char': 'string',
  'long': 'number',
  'int': 'number'
};


/**
 * A regular expression matching all C types.
 * @const
 */
var cTypesRegexp = Object.keys(cTypesToJs).join('|');

cSource = replace(cSource, [
  [/\t/g, '  '],
  [/#include/g, '// #include'],
  [/->/g, '.'],
  [/\b==\b/g, ' === '],
  [/\bNULL\b/g, 'null'],
  [/#if 0/g, 'if (0) {'],
  [/#ifdef (.+)/g, 'if ($1) {'],
  [/#ifndef (.+)/g, 'if (!$1) {'],
  [/#else/g, '} else {'],
  [/#endif/g, '}'],

  // One line '/*'' style comments to '//'.
  [/\/\*(.+)\*\//g, function(a, b) {
    return '// ' + b.trim();
  }],

  // Replace #define by var.
  [/(\s*)\#define\s+(\S+)\s+(\S+)/g, '$1/** @const */ var $2 = $3;'],

  // Parse functions and generate JS equivalent + JSDoc annotations.
  //[/\n([a-z0-9_* ]+)\s(\S+)\(([^);&|=.]*)\)/gm, function(s, returnType, functionName, parameters) {
  [/\n([a-z0-9_* ]+)\s(\S+)\(([^);&|=\.]*)\)/g, function(s, returnType, functionName, parameters) {
    var str = '\n',
        i, tmp,
        argType, argName, argReference,
        args = [],
        returnJSType;

    //util.puts('returnType', util.inspect(returnType));

    // We do not parse native C functions.
    if (isNativeFunction(returnType) || isNativeFunction(functionName)) {
      return '\n' + returnType + ' ' + functionName + '(' + parameters + ')';
    }

    // Check reference notation.
    if (functionName.substr(0, 1) === '*') {
      argReference = true;
      functionName = functionName.substr(1).trim();
    } else {
      argReference = false;
    }

    // Start annotation block.
    if (returnType.length || parameters.length) {
      str += '/**\n';

      if (argReference) {
        str += ' * Function passed as reference.\n';
      }
    }

    // '@param' annotations.
    if (parameters) {
      parameters = parameters.split(',');
      for (i = 0; i < parameters.length; i++) {
        tmp = parameters[i].trim().split(' ');
        argType = tmp[0].trim();
        argName = tmp[1];

        if (typeof argName === 'undefined') {
          return '\n' + returnType + ' ' + functionName + '(' + parameters + ')';
        }

        if (argName.substr(0, 1) === '*') {
          argReference = true;
          argName = argName.substr(1).trim();
        } else if (argType.substr(-1, 1) === '*') {
          argReference = true;
          argType = argType.substr(0, argType.length - 1).trim();
        } else {
          argReference = false;
        }
        args.push(argName);

        str += ' * @param {' + getCType(argType) + '} ' + argName;
        str += argReference ? ' (passed as reference)' : '';
        str += '\n';
      }
    }

    // '@return' annotations.
    if (returnType) {
      returnType = returnType.split(' ');
      for (i = 0; i < returnType.length; i++) {
        returnJSType = getCType(returnType[i]);
        str += returnJSType ? ' * @return {' + getCType(returnType[i]) + '}\n' : '';
      }
    }

    // Close annotation block.
    if (str.length > 1) {
      str += ' */\n';
    }

    str += 'function ' + functionName + '(' + args.join(', ') + ')';

    return str;

    /**
     * Looks for native C function. Returns true if so.
     * @param {string} str
     * @return {boolean}
     */
    function isNativeFunction(str) {
      str = str.trim();
      return reservedKeywords.indexOf(str) > -1;
    }

    /**
     * Returns a JavaScript primitive given a C type.
     * @param {string} str
     * @return {string}
     */
    function getCType(str) {
      str = str.trim();

      if (typeof cTypesToJs[str] != 'undefined') {
        return cTypesToJs[str];
      }

      if (str === 'void' || str === 'static') {
        return '';
      }

      return str;
    }
  }],

  // Replace var declarations and annotate type.
  [RegExp('( +)(' + cTypesRegexp + ')\\s*(.+);', 'g'), function(s, space, cType, varName) {
    return space + '/** @type {' + cTypesToJs[cType] + '} */ var ' + varName + ';';
  }],

  // Replace var declarations for user defined types.
  [/([\{\},\n;]\s*)([a-zA-Z_]+_t)\s*[\*&]?([a-zA-Z_\d]+\s*=)/g, '$1/** @type {$2} */ var $3'],
  [/([\{\},\n;]\s*)([a-zA-Z_]+_t)\s*[\*&]?([a-zA-Z_\d\[\]]+\s*)([,;])/g, '$1/** @type {$2} */ var $3 = {}$4'],

  // Remove &var and *var notations.
  [/([\{\}\(,\n;=]\s*)[\*&]([a-zA-Z_]+)/g, '$1$2'],

  // Transform malloc allocations to class instantiations.
  [/\(([a-zA-Z_]+) \*\)malloc\(sizeof\(\1\)\);/g, 'new $1();'],

  // Specific rules.
  // @todo Remove the last \n in fprintf.
  [/fprintf\(MSG_OUT, *([^)]+)/g, 'printf($1'],
  [/fprintf\(MSG_OUT, */g, 'printf('],
  [/fprintf\(stderr, *([^)]+)\)/g, 'console.error(sprintf($1))'],
  [/\bTRACE\b/g, 'DEBUG']
]);

function replace(str, pairs) {
  var i = 0,
      len = pairs.length;

  for (; i < len; i++) {
    str = str.replace(pairs[i][0], pairs[i][1]);
  }

  str = str.trim();

  return str;
}

//return;

util.puts(cSource);
