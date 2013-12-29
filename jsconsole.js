(function(window, document) {

	function Cursor(console) {
		this.console = console;
		this.el = createElement('span', 'cursor');
	}

	Cursor.prototype = {
		writeChar: function(c) {
			var node = document.createTextNode(c);
			this.el.parentNode.insertBefore(node, this.el);
		},

		del: function() {
			removeText(this.el.nextSibling);
		},

		backspace: function() {
			removeText(this.el.previousSibling);
		},

		moveToWord: function(verb) {
			var node = this.el[verb + 'Sibling'],
				target = null;
			do {
				if (!node || node.nodeType !== 3) {
					break;
				}

				if (node.nodeValue === ' ') {
					if (target) {
						break;
					}
				} else {
					target = verb === 'next' ? node.nextSibling : node;
				}
			} while (node = node[verb + 'Sibling']);

			if (target|| verb === 'next') {
				this.el.parentNode.insertBefore(this.el, target);
			}
		},

		moveToChar: function(verb) {
			var node = this.el[verb + 'Sibling'];
			if (!node || node.nodeType !== 3) {
				return;
			}
			if (verb === 'next') {
				node = node.nextSibling;
			}

			this.el.parentNode.insertBefore(this.el, node);
		},

		prevChar: function() {
			this.moveToChar('previous');
		},

		prevWord: function() {
			this.moveToWord('previous');
		},

		nextChar: function() {
			this.moveToChar('next');
		},

		nextWord: function() {
			this.moveToWord('next');
		}
	};

	function createElement(tag, cls) {
		var el = document.createElement(tag);
		if (cls) {
			el.className = 'jsconsole-' + cls;
		}

		return el;
	}

	function remove(node) {
		node && node.parentNode && node.parentNode.removeChild(node);
	}

	function removeText(node) {
		node && node.nodeType === 3 && remove(node);
	}

	function Console(element, options) {
		this.el = typeof(element) === 'string' ? document.getElementById(element) : element;
		this.options = options || {};
		this.cursor = new Cursor(this);
		this._stop = null;
		this.container = null;
		this.lines = [];
		this.prompt = this.options.prompt || '$ ';

		if (this.prompt) {
			var prompt = createElement('span', 'prompt');
			prompt.appendChild(document.createTextNode(this.prompt));
			this.prompt = prompt;
		}
		this.render();
	}

	Console.prototype = {
		render: function() {
			this.container = createElement('div', 'container');
			this.newLine();
			this.el.appendChild(this.container);
		},

		write: function(text) {
			if (!text) {
				return;
			}

			for (var i = 0; i < text.length; i++) {
				this.cursor.writeChar(text.charAt(i));
			}
		},

		newLine: function() {
			var line = createElement('div', 'line');
			if (this.prompt) {
				line.appendChild(this.prompt.cloneNode(true));
			}
			line.appendChild(this.cursor.el);
			this.container.appendChild(line);
			this.lines.push(line);
		},

		handleKeyUp: function(e) {
			console.log('keyup: %d', e.keyCode);
		},

		handleKeyDown: function(e) {
			console.log('keydown: %d', e.keyCode);
		},
		handleKeyPress: function(e) {
			console.log('keypress: %d %d ctrl: %b, alt: %b, shift: %b', e.charCode, e.keyCode, e.ctrlKey, e.altKey, e.shiftKey);

			if (e.altKey) {
				return;
			}

			function prevent() {
				e.preventDefault();
				return true;
			}

			if (e.keyCode) {
				//a non-alphabetical character
				switch (e.keyCode) {
					case 13: prevent() && this.newLine(); break;
					case 8: prevent() && this.cursor.backspace(); break;
					case 46: prevent() && this.cursor.del(); break;
					case 37: prevent() && this.cursor['prev' + (e.ctrlKey ? 'Word' : 'Char')](); break;
					case 39: prevent() && this.cursor['next' + (e.ctrlKey ? 'Word' : 'Char')](); break;
				}

				return;
			}

			if (e.altKey || e.metaKey) {
				return;
			}

			if (e.ctrlKey && (e.charCode === 67 || e.charCode === 99)) {
				//ctrl+C
				prevent();
				this.write('^C');
				this.newLine();
				return;
			}

			if (e.ctrlKey) {
				return;
			}

			if (e.charCode >= 32 && e.charCode <= 126) {
				prevent();
				this.write(String.fromCharCode(e.charCode));
			}
		},

		start: function(scope) {
			scope = scope || document;
			var press = this.handleKeyPress.bind(this);

			scope.addEventListener('keypress', press, false);

			this._stop = function() {
				scope.removeEventListener('keypress', press, false);
			};
		},

		stop: function() {
			this._stop && this._stop();
		}
	};

	window.JSConsole = Console;

}(window, document));