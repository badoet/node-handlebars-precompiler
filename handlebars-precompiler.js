// Modified version of https://github.com/wycats/handlebars.js/blob/master/bin/handlebars
// Changed from command-line compiler to node module

var fs = require('fs'),
    handlebars = require('handlebars'),
    basename = require('path').basename,
    uglify = require('uglify-js'),
    vm = require('vm');

exports.do = function(opts) {

  (function(opts) {
    var template = [0];
    if (!opts.templates.length) {
      throw 'Must define at least one template or directory.';
    }

    opts.templates.forEach(function(template) {
      fs.statSync(template);
      try {
        fs.statSync(template);
      } catch (err) {
        throw 'Unable to open template file "' + template + '"';
      }
    });
    if (opts.simple && opts.min) {
      throw 'Unable to minimze simple output';
    }
    if (opts.simple && (opts._.length !== 1 || fs.statSync(opts._[0]).isDirectory())) {
      throw 'Unable to output multiple templates in simple mode';
    }
  }(opts));

  var template = opts.templates[0];

  // Convert the known list into a hash
  var known = {};
  if (opts.known && !Array.isArray(opts.known)) {
    opts.known = [opts.known];
  }
  if (opts.known) {
    for (var i = 0, len = opts.known.length; i < len; i++) {
      known[opts.known[i]] = true;
    }
  }

  var output = [];
  
  function processTemplate(template, root) {
    var path = template,
        stat = fs.statSync(path);

    // make the filename regex user-overridable
    var fileRegex = /\.handlebars$/;
    
    if (stat.isDirectory()) { // if its dir, loop through file in dir
      fs.readdirSync(template).map(function(file) {
        var path = template + '/' + file;
    if (fileRegex.test(path) ) {
          processTemplate(path, root || template);
        }
      });
    } else { // real shit
      var data = fs.readFileSync(path, 'utf8');
      
       //dummy jQuery
	var jQuery = function() { return jQuery; };
	jQuery.ready = function() { return jQuery; };
	jQuery.inArray = function() { return jQuery; };
	jQuery.jquery = "1.7.2";

	//dummy DOM element
	var element = {
	    firstChild: function () { return element; },
	    innerHTML: function () { return element; }
	};

	var sandbox = {
	    // DOM
	    document: {
	    createRange: false,
	    createElement: function() { return element; }
	    },

	    // Console
	    console: console,

	    // jQuery
	    jQuery: jQuery,
	    $: jQuery,

	    // handlebars template to compile
	    template: fs.readFileSync(path, 'utf8'),

	    // compiled handlebars template
	    templatejs: null
	};
	
	// window
	sandbox.window = sandbox;
	
	// create a context for the vm using the sandbox data
	var context = vm.createContext(sandbox);
	
	// load Ember into the sandbox
	vm.runInContext(opts.emberjs, context, 'ember.js');
	
	//compile the handlebars template inside the vm context
	vm.runInContext('templatejs = Ember.Handlebars.precompile(template).toString();', context);

	// Clean the template name
	if (!root) {
	    template = basename(template);
	} else if (template.indexOf(root) === 0) {
	    template = template.substring(root.length+1);
	}
	template = template.replace(fileRegex, '');
	
	output.push('Ember.TEMPLATES["' + template + '"] = Handlebars.template(' + context.templatejs + ');');
    }
  }

  opts.templates.forEach(function(template) {
    processTemplate(template, opts.root);
  });

  output = output.join('');

  if (opts.min) {
    var ast = uglify.parser.parse(output);
    ast = uglify.uglify.ast_mangle(ast);
    ast = uglify.uglify.ast_squeeze(ast);
    output = uglify.uglify.gen_code(ast);
  }

  if (opts.output) {
    fs.writeFileSync(opts.output, output, 'utf8');
  } else {
    return output;
  }
}

exports.watchDir = function(dir, outfile, ember_path) {
  var fs = require('fs')
    , file = require('file')
    , emberjs = fs.readFileSync(ember_path, 'utf8');;

  var regex = /\.handlebars$/;

  var compileOnChange = function(event, filename) {
    console.log('[' + event + '] detected in ' + (filename ? filename : '[filename not supported]'));
    console.log('[compiling] ' + outfile);
    exports.do({
      templates: [dir],
      output: outfile,
      emberjs: emberjs,
      min: true
    });
  }

  file.walk(dir, function(_, dirPath, dirs, files) {
    if(files) {
      for(var i = 0; i < files.length; i++) {
        var file = files[i];
        if(regex.test(file)) {
          fs.watch(file, compileOnChange);
          console.log('[watching] ' + file);
        }
      }
    }
  });
}