function db() {
	this.init = function() {
		this.null_func = function(){};
		this.name = 'db';
	};

	this.execute = function(sql, callback, options) {
		require_string(sql);
		callback = opt_function(callback, this.null_func, this.name);
		options = opt_object(options, {}, this.name);
		//TODO: implement syncronous requests
		var async = options.async === false? false : true;

		var format = 'array';
		if(options.format) {
			if(options.format === 'array' || options.format === 'json') {
				format = options.format;
			}
			else {
				throw 'Invalid value for options.format in ' + this.name + ': ' + options.format;
			}
		}

		var parameters = {
			'query': sql,
			'format': format
		};

		new Ajax.Request('php/mysql_query.php',
				{
					'method': 'post',
					'parameters': parameters,
					'asynchronous': async,
					'onSuccess': function(transport) {
						var response = transport.responseText;
						alert(response);
						try {
							var reply = eval(response);
						}
						catch(e){
							var reply = 'error!';
							alert('failure!');
						}
						if(callback) {
							alert(Object.toJSON(reply));
							callback(reply);
						}
					},
					'onFailure': function(transport) {
						var response = transport.responseText;
						var reply = 'failure!';
						alert('failure!');
					}
				});

		alert('db execute now: ' + sql + format);
	};
}
