/**
 * @project JSXaal
 * @version 0.1b
 * @author Ville Karavirta (vkaravir@cs.hut.fi)
 * @description <a href=".">JSXaal</a>
 * @file jsxaal-viewer.js This file contains the main class of the JSXaal viewer.
 */
var JSXaal = Class.create();
var JSXaalViewerStore = {};
/**
 * <b>TODO</b>: move this to be JSXaal.Viewer
 * @class JSXaalViewer
 */
var JSXaalViewer = Class.create({
/**
 * Constructor
 * @function {public void} JSXaalViewer
 * @param {Object} fileUrl
 * @param {Object} elementId
 * @param {optional Array} settings Settings passed on to the {@link JSXaalViewerSettings}.
 * @param {optional String} format Parameter specifying the xslt-file url. This parameter has to 
 * 	be specified if the xslt-approach is to be used. Note, that in this case you must also 
 * 	provide the settings array.  
 */
	initialize: function(elementId, settings, options) {
		this.id = elementId;
		this.options = options;
		this.toolbar = new JSXaal.UI.Toolbar(this);
		this.settings = new JSXaalViewerSettings(this, settings);
		this.animator = new JSAnimator(this);
		this.ui = new JSXaal.UI(elementId, this);
		if (Graphic.rendererSupported("VML")) {
			this.renderer = new Graphic.VMLRenderer(this.ui.drawingId);
		} else if (Graphic.rendererSupported("SVG")) {
			this.renderer = new Graphic.SVGRenderer(this.ui.drawingId);
		} else if (Graphic.rendererSupported("Canvas")) {
			this.renderer = new Graphic.CanvasRenderer(this.ui.drawingId);
		}
        	this.toolManager = new Graphic.ToolManager(this.renderer);
		//this.toolManager.setTool(new Graphic.HighlightTool());
		//this.toolManager.setTool(new Graphic.DrawingTool());
		this.dsStore = new Hash();
		this.styleStore = {};
		this.dsGraphicsMap = {};
		this.parser = new JSXaalParser(this);
		//this.fileUrl = fileUrl;
		JSXaalViewerStore[elementId] = this;
		JSXaalParserDS.register(this.parser);
		JSXaalParserGP.register(this.parser);
		JSXaalParserAnim.register(this.parser);
		JSXaalInteractionParser.register(this.parser);
		JSXaalMainParser.register(this.parser);
		this.parser.registerElementHandlerFunction("narrative", this.renderNarrativeElement);
		var args = $H(options);
		this.fileUrl = args.get('fileUrl');
		if (args.get('stylesheet') && this.fileUrl) {
			this.xsltfile = args.get('stylesheet');
			this.transformFile();
		} else if (args.get('srcElem')) {
			this.initFromElement(args.get('srcElem'));
		} else if (this.fileUrl) {
			this.loadFile();
		} else {
			alert("check your parameters!");
		}
	},
	/**
	 * @function {public void} ?
	 * @param {String} fileName - name of the file
	 */
	setFile: function(fileName) {
		this.clear();
		this.fileUrl = fileName;
		this.loadFile();
	},
	clear: function() {
		this.renderer.clear();
		this.animator = new JSAnimator(this);
		this.dsStore = new Hash();
		this.styleStore = {};
	},
	/**
	 * This function should not be called directly. It loads the animation and
	 * the required xslt-file used in the xslt-transformation approach.
	 * @function {private void} ?
	 * @author ville
	 */
	transformFile: function() {
		this.animator.createPanel(this.ui.elemId + '-panel');
		var request = new Ajax.Request(this.fileUrl, {
		  method: 'get',
		  asynchronous: false,
		  onSuccess: function(transport) {this.xmlsrc = transport.responseXML;}.bind(this),
		  onFailure: function() {
		  	alert("Failed to load the document at:\n"+this.fileUrl);
		  }
		});
		var request2 = new Ajax.Request(this.xsltfile, {
		method: 'get',
		  asynchronous: false,
		  onSuccess: this.transformSuccess.bind(this),
		  onFailure: function() {
		  	alert("Failed to load the document at:\n"+xslt);
		  }	
		});
	},
	transformSuccess: function(transport) {
		var xslt = transport.responseXML;
		// code for IE
		if (window.ActiveXObject) {
  			ex = this.xmlsrc.transformNode(xslt);
  		}
		// code for Mozilla, Firefox, Opera, etc.
		else if (document.implementation && document.implementation.createDocument) {
  			xsltProcessor = new XSLTProcessor();
  			xsltProcessor.importStylesheet(xslt);
  			resultDocument = xsltProcessor.transformToDocument(this.xmlsrc);
			this.xmlsrc = null;
  			this.render(JSXaal.Util.recreateDocument(resultDocument.childNodes[0], this));
  		}
	},
	loadFile: function() {
		this.animator.createPanel(this.ui.elemId + '-panel');
		var successFunction = this.success.bind(this);
		var request = new Ajax.Request(this.fileUrl, {
		  method: 'get',
		  asynchronous: false,
		  onSuccess: successFunction,
		  onException: function(request, e) {debug("Xaal exception: "+e.message);},
		  onFailure: function() {
		  	alert("Failed to load the document at:\n"+this.fileUrl);
		  }
		});
	},
	initFromElement: function(srcElem) {
		debug($(srcElem).innerHTML.escapeHTML());
		this.animator.createPanel(this.ui.elemId + '-panel');
		this.render(JSXaal.Util.recreateDocument($(srcElem).getElementsByTagName('xaal')[0], this));
	},
	reload: function() {
		this.renderer.clear();
		if (!this.xsltfile) {
			this.loadFile();
		} else {
			this.transformFile();
		}
	},
	success: function(transport) {
		//alert(transport.responseText);
		//alert(Builder.build(transport.responseText).readAttribute("id"));
	  	var response = transport.responseXML;
	  	this.render(JSXaal.Util.recreateDocument(response.documentElement, this));
	  	//this.render(Builder.build(transport.responseText));
	},
	render: function(xaalDocument) {
		var x = xaalDocument;
		var msg = "";
		var i = 0;
		var children = xaalDocument.childElements();
		for (; i < children.length; i++) {
			if (children[i].nodeName.toLowerCase() == 'initial') {
				this.renderInitialElement(children[i]);
				this.animator.setInitial(children[i]);
			} else if (children[i].nodeName.toLowerCase() == 'animation') {
				this.animator.setAnimation(children[i].childElements().reverse());
			} else if (children[i].nodeName.toLowerCase() == 'defs') {
				this.parser.handleElement(children[i]);
			}
		}
	},
	/**
	 * A function that renders the contents of the <code>initial</code> element
	 * of the Xaal document.
	 * @function {private void} ?
	 * @param {Object} initialNode
	 */
	renderInitialElement: function(initialNode) {
		var children = initialNode.childElements();
		var length = children.length;
		for (var i = 0; i < length; i++) {
			try {
				var obj = this.parser.handleElement(children[i]);
				if (JSXaal.Util.isShapeObject(obj)) {
					this.renderer.add(obj);
				} else {
					debug("not a shape object ");					
				}					
			} catch (e) {
				debug("EROR:" + e.name + " - " + e.message);
			}
		}
	},
	renderNarrativeElement: function(viewer, narrativeNode) {
		if (!viewer.settings.isShowNarrative()) {
			return;
		}
		viewer.animator.setNarrative(JSXaal.Util.getContentsAsText(narrativeNode));
	},
	setServerInterface: function(si) {
		this.serverInterface = si;
	},
	getServerInterface: function() {
		return this.serverInterface;
	},
	exportSvg: function(targetElem) {
		if (!(this.renderer instanceof Graphic.SVGRenderer)) {
			debug("only SVG can be exported");
			return;
		}
		var elem = $(targetElem);
		var src = $(this.ui.elemId + '-drawing');
		elem.update(JSXaal.Util.getContentsAsText(src).escapeHTML());
	},
	showAnotherStep: function(stepDiff, options) {
		options = Object.extend({title: 'Step ' + stepDiff, scale: 0.3}, options || {});
		debug('showing step ' + stepDiff);
		this.animator.addStepViewer(stepDiff, options);
	}
});/**
 * @file jsxaal-parser.js Contains the backbone of the parser.
 */
/**
 * @class JSXaalParser
 */
var JSXaalParser = Class.create({
	/**
	 * Constructor of the parser.
 	 * @function {public void} JSXaalParser
	 * @param {Object} jsviewer
	 */
	initialize: function(jsviewer) {
		this.viewer = jsviewer;
		this.startHandlers = {}; 
		this.stack = {};
	},
	/**
	 * @function {public Object} ?
	 * @param {Object} xmlNode
	 */
	handleElement: function(xmlNode) {
		var sH = this.startHandlers[xmlNode.nodeName.toLowerCase()];
		if (sH) {
			return sH(this.viewer, xmlNode);
		}
	},
	/**
	 * @function {public void} ?
	 * @param {Object} elementName
	 * @param {Object} startHandlerFunction
	 * @param {Object} endHandlerFunction
	 */
	registerElementHandlerFunction: function(elementName, startHandlerFunction) {
		if (startHandlerFunction) {
			this.startHandlers[elementName] = startHandlerFunction;
		}
	}
});var JSXaalInteractionParser = {};
JSXaalInteractionParser.register = function(parser) {
	parser.registerElementHandlerFunction("select-one", JSXaalInteractionParser.renderSelectOneElement);
	parser.registerElementHandlerFunction("select", JSXaalInteractionParser.renderSelectElement);
};
/**
 * @function {public void} ?
 * @param {Object} viewer
 * @param {Object} node
 */
JSXaalInteractionParser.renderSelectOneElement = function(viewer, node) {
	var children = node.childElements();
	var q = new JSXaal.Question.SelectOne(node.readAttribute("id"), viewer);
	var solutionId = node.readAttribute("solutionId");
	var answered = node.getElementsByTagName("student-answer").length > 0;
	if (!answered) {
		for ( var i = 0; i < children.length; i++) {
			var child = children[i];
			if (child.nodeName.toLowerCase() == 'contents'
					&& child.readAttribute("type") == "label") {
				q.setQuestionText(JSXaal.Util.getContentsAsText(child));
			} else if (child.nodeName.toLowerCase() == 'item') {
				var item = new JSXaal.Question.Item(child.readAttribute("id"));
				var contents = child.getElementsByTagName("contents");
				for ( var j = 0; j < contents.length; j++) {
					if (contents[j].readAttribute("type") == "answer") {
						item.setAnswer(JSXaal.Util
								.getContentsAsText(contents[j]));
					} else if (contents[j].readAttribute("feedback")) {
						item.setFeedback(JSXaal.Util
								.getContentsAsText(contents[j]));
					}
				}
				if (solutionId && solutionId == child.readAttribute("id")) {
					q.setCorrectAnswer(item);
				}
				q.addAnswerOption(item);
			} else if (child.nodeName.toLowerCase() == 'student-answer') {
				answered = true;
				break;
			}
		}
		if (viewer.settings.isStoreQuestionAnswers()) {
			q.setXmlNode(node);
		}
		viewer.ui.showQuestion(q);
	}
};
/**
 * @function {public void} ?
 * @param {Object} viewer
 * @param {Object} node
 */
JSXaalInteractionParser.renderSelectElement = function(viewer, node) {
	var children = node.childElements();
	var q = new JSXaal.Question.Select(node.readAttribute("id"), viewer);
	var solutionId = node.readAttribute("solutionId");
	var answered = node.getElementsByTagName("student-answer").length > 0;
	if (!answered) { // ignore the question if student has already answered it
		for ( var i = 0; i < children.length; i++) {
			var child = children[i];
			if (child.nodeName.toLowerCase() == 'contents'
					&& child.readAttribute("type") == "label") {
				q.setQuestionText(JSXaal.Util.getContentsAsText(child));
			} else if (child.nodeName.toLowerCase() == 'item') {
				var item = new JSXaal.Question.Item(child.readAttribute("id"));
				item.setGrade(child.readAttribute("grade"));
				var contents = child.getElementsByTagName("contents");
				for ( var j = 0; j < contents.length; j++) {
					if (contents[j].readAttribute("type") == "answer") {
						item.setAnswer(JSXaal.Util
								.getContentsAsText(contents[j]));
					} else if (contents[j].readAttribute("feedback")) {
						item.setFeedback(JSXaal.Util
								.getContentsAsText(contents[j]));
					}
				}
				if (solutionId && solutionId == child.readAttribute("id")) {
					q.setCorrectAnswer(item);
				}
				q.addAnswerOption(item);
			} else if (child.nodeName.toLowerCase() == 'student-answer') {
				answered = true;
				break;
			}
		}
		if (viewer.settings.isStoreQuestionAnswers()) {
			q.setXmlNode(node);
		}
		viewer.ui.showQuestion(q);
	}
};
/**
 * @class JSXaalParserGP
 */
var JSXaalParserGP = {};
JSXaalParserGP.register = function(parser) {
	parser.registerElementHandlerFunction("rectangle", JSXaalParserGP.renderRectangleElement);
	parser.registerElementHandlerFunction("text", JSXaalParserGP.renderTextElement);
	parser.registerElementHandlerFunction("circle", JSXaalParserGP.renderCircleElement);
	parser.registerElementHandlerFunction("line", JSXaalParserGP.renderLineElement);
	parser.registerElementHandlerFunction("polyline", JSXaalParserGP.renderPolylineElement);
	parser.registerElementHandlerFunction("triangle", JSXaalParserGP.renderTriangleElement);
	parser.registerElementHandlerFunction("polygon", JSXaalParserGP.renderPolygonElement);
	parser.registerElementHandlerFunction("student-annotation", JSXaalParserGP.renderAnnotationElement);
	parser.registerElementHandlerFunction("shape", JSXaalParserGP.renderShapeElement);
};
/**
 * @function {public Graphic.Rectangle} ?
 * @param {Object} viewer
 * @param {Object} rectNode
 */
JSXaalParserGP.renderRectangleElement = function(viewer, rectNode) {
	var children = rectNode.childElements();
	var rect = new Graphic.Rectangle(viewer.renderer);
	JSXaal.Util.setID(rect, rectNode, viewer.id);
	var coordCount = 0;
	JSXaalParserGP.handleStyle(viewer, rectNode, rect);
	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		switch (child.nodeName.toLowerCase()) {
		case 'coordinate':
			if (coordCount === 0) {
				var coord = JSXaalParserGP.getCoordinate(viewer, child);
				rect.setLocation(coord.x, coord.y);
				coordCount++;						
			} else {
				var coord2 = JSXaalParserGP.getCoordinate(viewer, child);
				rect.setSize(coord2.x - rect.getLocation().x, 
						coord2.y - rect.getLocation().y);
			}
			break;
		case 'round':
			var rx = Number(child.readAttribute("x"));
			var ry = Number(child.readAttribute("y"));
			if (!rx && ry) { rx = ry; }
			else if (rx && !ry) { ry = rx; }
			if (rx && ry) {
				rect.setRoundCorner(rx, ry);
			}
			break;
		default:
			break;
		}
	}
	return rect;
};
/**
 * @function {private void} ?
 * @param {Object} viewer
 * @param {Object} xmlNode
 * @param {Object} shape
 */
JSXaalParserGP.handleStyle = function(viewer, xmlNode, shape) {
	var style;
	var styleId = xmlNode.readAttribute("x-style");
	if (styleId) {
		style = viewer.styleStore[styleId];
		JSXaalParserGP.applyStyle(style, shape);
	} else {
		var s = xmlNode.getElementsByTagName("x-style")[0];
		if (s) {
			style = JSXaalParserGP.parseStyle(s, viewer);
			JSXaalParserGP.applyStyle(style, shape);
		} else {
			shape.setStroke({r:0, g:0, b:0});
		}
	}
	var opacity = xmlNode.readAttribute("opacity");
	if (opacity) {
		opacity = Number(opacity)*255;
		if (shape.getStroke() != "none") { shape.setStrokeOpacity(opacity); }
		if (shape.getFill() != "none") { shape.setFillOpacity(opacity); }
	}
	var hidden = xmlNode.readAttribute("hidden");
	if (hidden == 'true') {
		if (shape.getStroke() != "none") { shape.setStrokeOpacity(0.001); }
		if (shape.getFill() != "none") { shape.setFillOpacity(0.001); }
	}
	return style;
};
/**
 * Applies a given style to the given shape.
 * @function {private void} ?
 * @param {Object} node
 * @param {Object} shape
 * @param {Object} viewer
 */
JSXaalParserGP.applyStyle = function(style, shape) {
	if (shape instanceof Graphic.Text) {
		JSXaalRenderer.setKeyStyle(shape, style);
	} else {
		JSXaalRenderer.setShapeStyle(shape, style);
	}
};
/**
 * Parses and returns a style from the given node.
 * @function {private void} ?
 * @param {Object} node
 * @param {Object} viewer
 */
JSXaalParserGP.parseStyle = function(node, viewer) {
	var children = node.childElements();
	var style = new Style();
	var id = node.readAttribute("id");
	if (id) {
		viewer.styleStore[id] = style;
		style.setId(id);
	}
	var childName;
	var child;
	for (var j = 0; j < children.length;j++) {
		child = children[j];
		childName = child.nodeName.toLowerCase();
		if (childName == 'font') {
			if (child.hasAttribute("size")) {
				style.setFontSize(child.getAttribute("size"));
			}
			if (child.hasAttribute("family")) {
				style.setFontFamily(child.getAttribute("family"));
			}
			if (child.hasAttribute("bold")) {
				style.setBold(child.getAttribute("bold"));
			}
			if (child.hasAttribute("italic")) {
				style.setItalic(child.getAttribute("italic"));
			}
		} else if (childName == 'color') {
			style.setColor(JSXaal.Util.convertColor(child));
		} else if (childName == 'fill-color') {
			style.setFillColor(JSXaal.Util.convertColor(child));
		} else if (childName == 'stroke') {
			var width = child.readAttribute("width");
			if (width) {
				style.setStrokeWidth(Number(width));
			}
		} else if (childName == 'arrow') {
			if (child.hasAttribute("forward")) {
				style.setForwardArrow(child.getAttribute("forward").toLowerCase() == "true");
			}
			if (child.hasAttribute("backward")) {
				style.setBackwardArrow(child.getAttribute("backward").toLowerCase() == "true");
			}
		}
	}
	return style;
};
/**
 * @function {public Graphic.Polyline} ?
 * @param {Object} viewer
 * @param {Object} polylineNode
 */
JSXaalParserGP.renderPolylineElement = function(viewer, polylineNode) {
	var children = polylineNode.childElements();
	var polyline = new Graphic.Polyline(viewer.renderer);
	JSXaal.Util.setID(polyline, polylineNode, viewer.id);
	JSXaalParserGP.handleStyle(viewer, polylineNode, polyline);
	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		if (child.nodeName.toLowerCase() == 'coordinate') {
			var point = JSXaalParserGP.getCoordinate(viewer, child);
			polyline.addPoint(point.x, point.y);
		}
	}
	return polyline;	
};
/**
 * @function {public Graphic.Polygon} ?
 * @param {Object} viewer
 * @param {Object} polygonNode
 */
JSXaalParserGP.renderPolygonElement = function(viewer, polygonNode) {
	var children = polygonNode.childElements();
	var polygon = new Graphic.Polygon(viewer.renderer);
	JSXaal.Util.setID(polygon, polygonNode, viewer.id);
	JSXaalParserGP.handleStyle(viewer, polygonNode, polygon);
	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		if (child.nodeName.toLowerCase() == 'coordinate') {
			var point = JSXaalParserGP.getCoordinate(viewer, child);
			polygon.addPoint(point.x, point.y);
		}
	}
	return polygon;		
};
JSXaalParserGP.renderTriangleElement = function(viewer, triangleNode) {
	var polygon = JSXaalParserGP.renderPolygonElement(viewer, triangleNode);
	firstPoint = polygon.getPoint(0);
	polygon.addPoint(firstPoint.x, firstPoint.y);
	return polygon;
};
/**
 * @function {public Graphic.Line} ?
 * @param {Object} viewer
 * @param {Object} lineNode
 */
JSXaalParserGP.renderLineElement = function(viewer, lineNode) {
	var children = lineNode.childElements();
	var line = new Graphic.Line(viewer.renderer);
	JSXaal.Util.setID(line, lineNode, viewer.id);
	var style = JSXaalParserGP.handleStyle(viewer, lineNode, line);
	var coord;
	var coord2;
	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		if (child.nodeName.toLowerCase() == 'coordinate') {
			if (!coord) {
				coord = JSXaalParserGP.getCoordinate(viewer, child);
			} else {
				coord2 = JSXaalParserGP.getCoordinate(viewer, child);
				line.setPoints(coord.x, coord.y, coord2.x, coord2.y);
			}
		}
	}
	var group = new Graphic.Group(viewer.renderer);
	if (style && style.isForwardArrow()) {
		JSXaalRenderer.renderArrow(coord, coord2, line.getID()+(JSXaalRenderer.counter++),
				style, group);
    }
	if (style && style.isBackwardArrow()) {
		JSXaalRenderer.renderArrow(coord2, coord, line.getID()+(JSXaalRenderer.counter++),
				style, group);
    }
	// TODO: need to figure out how to draw arrows so that they move if the line moves
	viewer.renderer.add(group);
	return line;		
};
/**
 * @function {public Graphic.Circle} ?
 * @param {Object} viewer
 * @param {Object} circleNode
 */
JSXaalParserGP.renderCircleElement = function(viewer, circleNode) {
	var children = circleNode.childElements();
	var circle = new Graphic.Circle(viewer.renderer);
	JSXaal.Util.setID(circle, circleNode, viewer.id);
	JSXaalParserGP.handleStyle(viewer, circleNode, circle);
	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		if (child.nodeName.toLowerCase() == 'center') {
			var center = JSXaalParserGP.getCoordinate(viewer, child);
			circle.setCenter(center.x, center.y);
		} else if (child.nodeName.toLowerCase() == 'radius') {
			debug("radius " + child.hasAttribute("length"));
			circle.setRadius(Number(child.readAttribute("length")));
		}
	}
	debug("drawing circle "+circle.getID() +" "+ circle.getLocation().x +","+circle.getLocation().y+" r:"+circle.getRadius());
	return circle;
};
/**
 * Render's and returns a Graphic.Text object.
 * @function {public Graphic.Text} ?
 * @param {Object} viewer The viewer object that the shape should be drawn on.
 * @param {Object} textElement The textElement dom node object
 * @return {Graphic.Text} A Grahic.Text object corresponding to the given dom element.
 */
JSXaalParserGP.renderTextElement = function(viewer, textElement) {
	var children = textElement.childElements();
	var text = new Graphic.Text(viewer.renderer);
	JSXaal.Util.setID(text, textElement, viewer.id);
	JSXaalParserGP.handleStyle(viewer, textElement, text);
	for (var i = 0;i<children.length;i++) {
		var child = children[i];
		if (child.nodeName.toLowerCase() == 'coordinate') {
            var coords = JSXaalParserGP.getCoordinate(viewer, child); 
            text.setLocation(coords.x, coords.y);
		}
	}
	var textContent = JSXaal.Util.getTextContents(textElement.getElementsByTagName("contents"), 
			viewer.settings.getLanguage());
	text.setTextValue(textContent);
	if (text.getFill() == 'none' && text.getStroke() == 'none') {
		text.setFill({r: 0, g: 0, b: 0, a: 0});
	}
	return text;
};
/**
 * A method that handles the rendering of the <code>&lt;student-annotation></code>
 * element.
 * @function {public void} ?
 * @param {Object} viewer
 * @param {Element} annoElement
 */
JSXaalParserGP.renderAnnotationElement = function(viewer, annoElement){
	var children = annoElement.childElements();
	for (var i = 0, len = children.length; i < len; i++) {
		try {
			var obj = viewer.parser.handleElement(children[i]);
			debug("anno:"+obj.getPoints());
			if (JSXaal.Util.isShapeObject(obj)) {
				viewer.renderer.add(obj);
			} else {
				debug("failed to render student annotations");					
			}					
		} catch (e) {
			debug("ERROR:" + e.name + " - " + e.message);
		}
	}
};

JSXaalParserGP.getCoordinate = function(viewer, coordElem) {
    var offset = coordElem.getElementsByTagName('offset');
    if (offset.length === 0) {
        return {x: Number(coordElem.readAttribute("x")), y: Number(coordElem.readAttribute("y"))};
    } else if (offset.length > 0) {
        offset = offset[0];
        var coords = JSXaalParserGP.getCoordinate(viewer, offset);
        var pos = JSXaalParserGP.getObjectCoordinate(viewer, offset.readAttribute("base-object"), offset.readAttribute("anchor"));
        return {x: Number(coordElem.readAttribute("x")) + coords.x + pos.x, y: Number(coordElem.readAttribute("y")) + coords.y + pos.y};
    }
    return {x: 0, y: 0};
};

JSXaalParserGP.getObjectCoordinate = function(viewer, baseObj, anchor) {
    var obj = viewer.dsStore.get(baseObj);
    if (obj) {
        obj = viewer.renderer.get(obj.getId() + viewer.id);
    } else {
    	obj = viewer.renderer.get(baseObj + viewer.id);
    }
    if (obj) {
    	anchor = anchor.toUpperCase();
    	var r = obj.getBounds();
        if (anchor == "NW") {
            return {"x": r.x, "y": r.y};
        } else if (anchor == "N") {
            return {"x": r.x + r.w/2, "y": r.y};
        } else if (anchor == "NE") {
            return {"x": r.x + r.w, "y": r.y};
        } else if (anchor == "E") {
            return {"x": r.x + r.w, "y": r.y + r.h/2};
        } else if (anchor == "SE") {
            return {"x": r.x + r.w, "y": r.y + r.h};
        } else if (anchor == "S") {
            return {"x": r.x + r.w/2, "y": r.y + r.h};
        } else if (anchor == "SW") {
            return {"x": r.x, "y": r.y + r.h};
        } else if (anchor == "W") {
            return {"x": r.x, "y": r.y + r.h/2};
        } else if (anchor == "C") {
            return {"x": r.x + r.w/2, "y": r.y + r.h/2};
        } else if (anchor == "CENTER" || anchor == "C") {
            return {"x": r.x + r.w/2, "y": r.y + r.h/2};
        } else {
            
        }
        return obj.getLocation();
    }
    return {x:0,y:0};
};
JSXaalParserGP.renderShapeElement = function(viewer, shapeNode) {
	var id = shapeNode.readAttribute("uses");
	var coord = {x:0, y:0};
	var children = shapeNode.childElements();
	for (var i=0; i<children.length; i++) {
		if (children[i].nodeName.toLowerCase() == 'coordinate') {
			coord = JSXaalParserGP.getCoordinate(viewer, children[i]);
		} else if (children[i].nodeName.toLowerCase() == 'shape-scale') {
			var scale = Number(children[i].readAttribute('value'));
		}
	}
	if (!scale) {
		var scale = 1;
	}
	var shapes = viewer.shapes[id];
	for (i=0; i < shapes.length; i++) {
		shape = JSXaal.Util.useShapeObject(viewer, shapes[i], coord, scale);
		//viewer.renderer.add(shapes[i]);
	}
};/**
 * @class JSXaalParserAnim
 */
var JSXaalParserAnim = new Object();
JSXaalParserAnim.register = function(parser) {
	parser.registerElementHandlerFunction("par", JSXaalParserAnim.renderParElement);
	parser.registerElementHandlerFunction("seq", JSXaalParserAnim.renderSeqElement);
	parser.registerElementHandlerFunction("hide", JSXaalParserAnim.renderHideElement);
	parser.registerElementHandlerFunction("create", JSXaalParserAnim.renderCreateElement);
	parser.registerElementHandlerFunction("swap", JSXaalParserAnim.renderSwapElement);
	parser.registerElementHandlerFunction("move", JSXaalParserAnim.renderMoveElement);
	parser.registerElementHandlerFunction("scale", JSXaalParserAnim.renderScaleElement);
	parser.registerElementHandlerFunction("rotate", JSXaalParserAnim.renderRotateElement);
	parser.registerElementHandlerFunction("change-style", JSXaalParserAnim.renderChangeStyleElement);
};
JSXaalParserAnim.renderParElement = function(viewer, parNode){
	if (viewer.settings.isSmoothAnimation()) {
		viewer.animator.addEffect("startpar");		
	}
	parNode.childElements().each(
		function(item) {
			viewer.parser.handleElement(item);
		}
	);
	if (viewer.settings.isSmoothAnimation()) {
		viewer.animator.addEffect("endpar");
	}
};
JSXaalParserAnim.renderSeqElement = function(viewer, seqNode) {
	seqNode.childElements().each(
		function(item) {
			viewer.parser.handleElement(item);
		}
	);
};
JSXaalParserAnim.renderHideElement = function(viewer, hideNode) {
	var type = hideNode.readAttribute("type");
	if (!type) {
		type = "selected";
	}
	if (type == 'all') {
		var shapes = viewer.renderer.shapes();
		for (var i=0; i<shapes.size(); i++) {
			var shape = shapes[i];
			if (viewer.settings.isSmoothAnimation()) {
				if (shape.getStrokeOpacity() > 0.01 || shape.getFillOpacity() > 0.01)
					viewer.animator.addEffect(shape.getID(), "XaalOpacity", "{from:"+(shape.getStrokeOpacity()*255) + ", to:0.001}");
			} else {
				viewer.renderer.remove(shape);				
			}
		}		
	} else if (type == 'selected') {
		var shapes = hideNode.getElementsByTagName("object-ref");
		for (var i=0; i<shapes.length; i++) {
			var id = shapes[i].readAttribute('id') + viewer.id;
			var shape = viewer.renderer.get(id);
			if (viewer.settings.isSmoothAnimation()) {
				viewer.animator.addEffect(shape.getID(), "XaalOpacity", "{from:"+(shape.getStrokeOpacity()*255) + ", to:0.001}");
			} else {
				viewer.renderer.remove(shape);		
			}
		}		
	}
};
JSXaalParserAnim.renderCreateElement = function(viewer, createNode) {
	var children = createNode.childElements();
	for (var i = 0; i < children.length; i++) { 
		var shape = viewer.parser.handleElement(children[i]);
		if (JSXaal.Util.isShapeObject(shape)) {
			if (viewer.settings.isSmoothAnimation()) {
				var oldOpacity = shape.getStrokeOpacity();
				shape.setStrokeOpacity(0.01);
				shape.setFillOpacity(0.01);
				viewer.animator.addEffect(shape.getID(), "XaalOpacity", "{from:"+(shape.getStrokeOpacity()*255) + ", to:" + (oldOpacity*255) + "}");
			}
			viewer.renderer.add(shape);				
		}
	}
};
JSXaalParserAnim.renderMoveElement = function(viewer, moveNode) {
	var children = moveNode.childElements();
	var coord = moveNode.getElementsByTagName("coordinate")[0];
	var refs = moveNode.getElementsByTagName("object-ref");
	for (var i = 0; i < refs.length ; i++) {
		var id = refs[i].readAttribute("id") + viewer.id;
		if (id) {
			if (viewer.settings.isSmoothAnimation()) {
				viewer.animator.addEffect(id, "XaalMove", "{x:"+Number(coord.readAttribute("x")) + ", y:" + Number(coord.readAttribute("y")) + "}");
			} else {
				var shape = viewer.renderer.get(id);
				shape.translate(Number(coord.readAttribute("x")), Number(coord.readAttribute("y")));
			}
		}
	}
};
JSXaalParserAnim.renderScaleElement = function(viewer, scaleNode) {
	var targets = scaleNode.getElementsByTagName("object-ref");
	for (var i=0; i<targets.length; i++) {
		var id = targets[i].readAttribute("id") + viewer.id;
		var scale = Number(scaleNode.readAttribute("scale"));
		if (viewer.settings.isSmoothAnimation()) {
			viewer.animator.addEffect(id, "XaalScale", "{scaleTo:"+scale+ "}");
		} else {
			var elem = viewer.renderer.get(id);
			var bounds = elem.getBounds();
    			var cx = bounds.x + bounds.w/2.0;
    			var cy = bounds.y + bounds.h/2.0;
			elem.scale(scale, scale, cx, cy);
		}
	}
};
JSXaalParserAnim.renderRotateElement = function(viewer, rotateNode) {
	var degree = Number(rotateNode.readAttribute("degree"));
	var refs = rotateNode.getElementsByTagName("object-ref");
	for (var i = 0; i < refs.length ; i++) {
		var id = refs[i].readAttribute("id") + viewer.id;
		if (id) {
			if (viewer.settings.isSmoothAnimation()) {
				viewer.animator.addEffect(id, "XaalRotate", "{degree:" + degree + "}");
				debug(id + viewer.renderer.get(id));
			} else {
				viewer.renderer.get(id).rotate(degree);
			}
		}
	}
};
JSXaalParserAnim.renderChangeStyleElement = function(viewer, node) {
	var style = node.getElementsByTagName("x-style")[0];
	var styleRules = style.childElements();
	var styleString = "";
	var color, fillColor;
	var nodeCount = 0;
	var i = 0;	
	for (; i < styleRules.length; i++) {
		if (styleRules[i].nodeName.toLowerCase() == "color") {
			if (nodeCount >0) { styleString += ',';}
			styleString += "color:'" + JSXaal.Util.colorToString(styleRules[i]) + "'";
			color = JSXaal.Util.convertColor(styleRules[i]);
			nodeCount++;
		} else if (styleRules[i].nodeName.toLowerCase() == "fill-color") {
			if (nodeCount >0) { styleString += ',';}
			styleString += "fillcolor:'" + JSXaal.Util.colorToString(styleRules[i]) + "'";
			fillColor = JSXaal.Util.convertColor(styleRules[i]);
			nodeCount++;
		}
	}
	var newStyle = JSXaalParserGP.parseStyle(style, viewer);
	var redraw = [];
	var refs = node.getElementsByTagName("object-ref");
	for (i = 0; i < refs.length; i++) {
		var id = refs[i].readAttribute("id");
		if (id) {
			var str = viewer.dsStore.get(id);
			if (str) {
				if (str instanceof JSXaal.Structure) {
					str.setStyle(newStyle);
					redraw.push(str.getId());
				} else if (str instanceof JSXaal.Node) {
					var parent = viewer.dsStore.get(str.getParent().getId()); 
					if (newStyle && parent) {
						str.setStyle(newStyle);
						redraw.push(parent.getId());
					}
				}	
			} else {
				var obj = viewer.renderer.get(id + viewer.id);
				if (obj && JSXaal.Util.isShapeObject(obj)) {
					if (viewer.settings.isSmoothAnimation()) {
						viewer.animator.addEffect(id + viewer.id, "XaalMorph", "{style:{"+styleString + "}}");
					} else {
						if (color) {
							obj.setStroke(color);
						}
						if (fillColor) {
							obj.setFill(fillColor);
						}
					}
				} else if (obj instanceof Graphic.Group) {
					debug("group changing style..");
					viewer.renderer.remove(obj);
				}
			}
		}
	}
	redraw.uniq().each(function(item) {
		viewer.renderer.remove(viewer.renderer.get(item + viewer.id));
		viewer.dsStore.get(item).draw(viewer);
	});
};
JSXaalParserAnim.renderSwapElement = function(viewer, swapNode) {
	var swap = viewer.dsStore.get(swapNode.readAttribute("swap"));
	var sWith = viewer.dsStore.get(swapNode.readAttribute("with"));
	if (swap instanceof JSXaal.Key && sWith instanceof JSXaal.Key) {
		var sPar = swap.getParent();
		var wPar = sWith.getParent();
		sPar.setData(sWith);
		wPar.setData(swap);
		while (!(sPar instanceof JSXaal.Structure)) {
			sPar = sPar.getParent();
		}
		while (!(wPar instanceof JSXaal.Structure)) {
			wPar = wPar.getParent();
		}
		viewer.renderer.remove(viewer.renderer.get(sPar.getId() + viewer.id));
		sPar.draw(viewer);
		if (sPar != wPar) {
			debug("..and again");
			viewer.renderer.remove(viewer.renderer.get(wPar.getId() + viewer.id));
			wPar.draw(viewer);
		}
	}
	debug("swap "+swap+" with "+sWith);
};
JSXaalParserAnim.renderSwapIdElement = function(viewer, xmlNode) {
	var swap = viewer.dsStore.get(swapNode.readAttribute("swap"));
	var sWith = viewer.dsStore.get(swapNode.readAttribute("with"));
	var temp = swap.getId();
	swap.setId(sWith.getId());
	viewer.dsStore.set(sWith.getId(), swap);
	sWith.setId(temp);
	viewer.dsStore.set(temp, sWith);
};/**
 * @class JSXaalParserDS
 */
var JSXaalParserDS = new Object();	
JSXaalParserDS.register = function(parser) {
	parser.registerElementHandlerFunction("tree", JSXaalParserDS.renderTreeElement);
	parser.registerElementHandlerFunction("bintree", JSXaalParserDS.renderBinTreeElement);
	parser.registerElementHandlerFunction("bst", JSXaalParserDS.renderBstElement);
	parser.registerElementHandlerFunction("graph", JSXaalParserDS.renderGraphElement);
	parser.registerElementHandlerFunction("array", JSXaalParserDS.renderArrayElement);
	parser.registerElementHandlerFunction("list", JSXaalParserDS.renderListElement);
	parser.registerElementHandlerFunction("insert", JSXaalParserDS.renderInsertElement);
	parser.registerElementHandlerFunction("key", JSXaalParserDS.renderKeyElement);
};
JSXaalParserDS.renderTreeElement = function(viewer, treeNode) {
		var id = JSXaalParserDS.getId(treeNode);
		var rootId = treeNode.readAttribute("root");
		if (!rootId) {
			return;
		}
		var edges = new Array();
		var children = treeNode.childElements();
		var tree = new JSXaal.Tree(id);
		JSXaalParserDS.setStructureProperties(tree, treeNode);
		viewer.dsStore.set(id, tree);
		for (var i=0;i<children.length;i++) {
			if (children[i].nodeName.toLowerCase() == 'node') {
				JSXaalParserDS.parseNodeElement(viewer, children[i], new JSXaal.TreeNode());
			} else if (children[i].nodeName.toLowerCase() == 'edge'){
				edges.push(children[i]);
			} else if (children[i].nodeName.toLowerCase() == 'coordinate') {
				var coord = JSXaalParserGP.getCoordinate(viewer, children[i]);
				tree.setPosition(coord.x, coord.y);
			}
		}
		tree.setRoot(viewer.dsStore.get(rootId));
		edges.each(function(edge) {
			var fromNode = viewer.dsStore.get(edge.readAttribute("from"));
			var toNode = viewer.dsStore.get(edge.readAttribute("to"));
			fromNode.addChild(toNode);
		});
		tree.draw(viewer);
	};
JSXaalParserDS.renderBinTreeElement = function(viewer, treeNode) {
		var id = JSXaalParserDS.getId(treeNode);
		var rootId = treeNode.readAttribute("root");
		if (!rootId) {
			return;
		}
		var edges = new Array();
		var children = treeNode.childElements();
		var tree = new JSXaal.BinTree(id);
		JSXaalParserDS.setStructureProperties(tree, treeNode);
		viewer.dsStore.set(id, tree);
		for (var i=0;i<children.length;i++) {
			if (children[i].nodeName.toLowerCase() == 'node') {
				JSXaalParserDS.parseNodeElement(viewer, children[i], new JSXaal.BinTreeNode());
			} else if (children[i].nodeName.toLowerCase() == 'edge'){
				edges.push(children[i]);
			} else if (children[i].nodeName.toLowerCase() == 'coordinate') {
				var coord = JSXaalParserGP.getCoordinate(viewer, children[i]);
				tree.setPosition(coord.x, coord.y);
			}
		}
		tree.setRoot(viewer.dsStore.get(rootId));
		edges.each(function(edge) {
			var fromNode = viewer.dsStore.get(edge.readAttribute("from"));
			var toNode = viewer.dsStore.get(edge.readAttribute("to"));
			var child = edge.readAttribute("child");
			if (child && child.toLowerCase() == "left") {
				fromNode.setLeft(toNode);
			} else {
				fromNode.setRight(toNode);
			}
		});
		tree.draw(viewer);
	};
JSXaalParserDS.renderBstElement = function(viewer, treeNode) {
		var id = JSXaalParserDS.getId(treeNode);
		var rootId = treeNode.readAttribute("root");
		if (!rootId) {
			return;
		}
		var edges = new Array();
		var children = treeNode.childElements();
		var tree = new JSXaal.BinSearchTree(id);
		JSXaalParserDS.setStructureProperties(tree, treeNode);
		viewer.dsStore.set(id, tree);
		for (var i=0;i<children.length;i++) {
			if (children[i].nodeName.toLowerCase() == 'node') {
				JSXaalParserDS.parseNodeElement(viewer, children[i], new JSXaal.BinSearchTreeNode());
			} else if (children[i].nodeName.toLowerCase() == 'edge'){
				edges.push(children[i]);
			} else if (children[i].nodeName.toLowerCase() == 'coordinate') {
				var coord = JSXaalParserGP.getCoordinate(viewer, children[i]);
				tree.setPosition(coord.x, coord.y);
			}
		}
		tree.setRoot(viewer.dsStore.get(rootId));
		edges.each(function(edge) {
			var fromNode = viewer.dsStore.get(edge.readAttribute("from"));
			var toNode = viewer.dsStore.get(edge.readAttribute("to"));
			var child = edge.readAttribute("child");
			if (child && child.toLowerCase() == "left") {
				fromNode.setLeft(toNode);
			} else {
				fromNode.setRight(toNode);
			}
		});
		tree.draw(viewer);
	};
JSXaalParserDS.renderInsertElement = function(viewer, insertNode) {
	var str = viewer.dsStore.get(insertNode.readAttribute("target"));
	if (!str){ 
		debug("no structure to insert to");
		return;
	} else if (!str.insert) {
		debug("no insert function in the structure");
		return;
	}
	var children = insertNode.childElements();
	for (var i = 0; i < children.length; i++) {
		if (children[i].nodeName.toLowerCase() == 'key') {
			str.insert(children[i].readAttribute("value"));	
		}
	}
	str.draw(viewer);
};
JSXaalParserDS.renderGraphElement = function(viewer, graphNode) {
	var children = graphNode.childElements();
	var id = JSXaalParserDS.getId(graphNode);
	var graph = new JSXaal.Graph(id);
	JSXaalParserDS.setStructureProperties(graph, graphNode);
	viewer.dsStore.set(id, graph);
	for (var i=0;i<children.length;i++) {
		if (children[i].nodeName.toLowerCase() == 'node') {
			var node = new JSXaal.GraphNode();
			JSXaalParserDS.parseNodeElement(viewer, children[i], node);
			graph.addNode(node);
		} else if (children[i].nodeName.toLowerCase() == 'edge'){
			var edgeId = JSXaalParserDS.getId(children[i]);
			var edgeNode = children[i];
			var from = viewer.dsStore.get(edgeNode.readAttribute("from"));
			var to = viewer.dsStore.get(edgeNode.readAttribute("to"));
			var edge = new JSXaal.Edge(from, to);
			if (edgeNode.hasAttribute("directed")) {
				edge.setDirected("true" == edgeNode.readAttribute("directed").toLowerCase());
			}
			if (edgeId) {
				edge.setId(edgeId);
				viewer.dsStore.set(edgeId, edge);
			}
			if (edgeNode.readAttribute("label")) {
				edge.setLabel(edgeNode.readAttribute("label"));
			}
			var style = JSXaalParserDS.handleStyle(viewer, edgeNode);
			if (style) {
				edge.setStyle(style); 
			}

			graph.addEdge(from, to, edge);
		} else if (children[i].nodeName.toLowerCase() == 'coordinate') {
			var coord = JSXaalParserGP.getCoordinate(viewer, children[i]);
			graph.setPosition(coord.x, coord.y);
		}
	}
	graph.draw(viewer);
};
JSXaalParserDS.renderListElement = function(viewer, listNode) {
	var children = listNode.childElements();
	var id = JSXaalParserDS.getId(listNode);
	var list = new JSXaal.List(id);
	JSXaalParserDS.setStructureProperties(list, listNode);
	viewer.dsStore.set(id, list);
	for (var i=0;i<children.length;i++) {
		if (children[i].nodeName.toLowerCase() == 'node') {
			var node = new JSXaal.ListNode();
			JSXaalParserDS.parseNodeElement(viewer, children[i], node);
			if (!list.getHead()) {
				list.setHead(node);
			}
		} else if (children[i].nodeName.toLowerCase() == 'edge'){
			var edgeNode = children[i];
			var from = viewer.dsStore.get(edgeNode.readAttribute("from"));
			var to = viewer.dsStore.get(edgeNode.readAttribute("to"));
			var style = JSXaalParserDS.handleStyle(viewer, edgeNode);
			from.setNext(to, style);
		} else if (children[i].nodeName.toLowerCase() == 'coordinate') {
			var coord = JSXaalParserGP.getCoordinate(viewer, children[i]);
			list.setPosition(coord.x, coord.y);
		}
	}
	list.draw(viewer);
};
JSXaalParserDS.parseNodeElement = function(viewer, node, nodeObj) {
	nodeObj.setId(JSXaalParserDS.getId(node));
	var data = viewer.parser.handleElement(node.getElementsByTagName("key")[0]);
	nodeObj.setData(data);
	var coord = node.getElementsByTagName("coordinate")[0];
	if (coord) {
		nodeObj.setPosition(coord.readAttribute("x"), coord.readAttribute("y"));
	}
	var style = JSXaalParserDS.handleStyle(viewer, node);
	if (style) {
		nodeObj.setStyle(style); 
	}
	viewer.dsStore.set(nodeObj.getId(), nodeObj);
};
/**
 * @function {private static void} ?
 * @param {Object} viewer
 * @param {Object} arrayNode
 */
JSXaalParserDS.renderArrayElement = function(viewer, arrayNode) {
	var children = arrayNode.childElements();
	var id = JSXaalParserDS.getId(arrayNode);
	var array = new JSXaal.Array(id);
	JSXaalParserDS.setStructureProperties(array, arrayNode);
	viewer.dsStore.set(id, array);
	if (arrayNode.readAttribute("indexed") && arrayNode.readAttribute("indexed") == "false") {
		array.setIndexed(false);
	}
	var style = JSXaalParserDS.handleStyle(viewer, arrayNode);
	if (style) {
		array.setStyle(style);
	}
	for (var i = 0; i < children.length; i++) {
		if (children[i].nodeName.toLowerCase() == 'index') {
			var ind = children[i];
			var indexNum = array.getSize();
			if (ind.readAttribute("index")) {
				indexNum = Number(ind.readAttribute("index"));
			}
			var data = viewer.parser.handleElement(ind.getElementsByTagName("key")[0]);
			array.setData(indexNum, data);
			if (ind.readAttribute("label")) {
				array.setIndexText(indexNum, ind.readAttribute("label"));
			}
			style = JSXaalParserDS.handleStyle(viewer, ind);
			if (style) {
				array.setIndexStyle(indexNum, style);
			}
			var indexObj = array.getIndex(indexNum);
			data.setParent(indexObj);
			id = ind.readAttribute("id");
			if (id) {
				indexObj.setId(id);
				viewer.dsStore.set(id, indexObj);
				indexObj.setParent(array);
			}
		} else if (children[i].nodeName.toLowerCase() == 'coordinate') {
			var coord = JSXaalParserGP.getCoordinate(viewer, children[i]);
			array.setPosition(coord.x, coord.y);
		}
	}
	array.draw(viewer);
};
JSXaalParserDS.setStructureProperties = function(str, node) {
	var strProperties = node.getElementsByTagName("structure-property");
	for (var i=0; i < strProperties.length; i++) {
		str.setProperty(strProperties[i].readAttribute("name"), strProperties[i].readAttribute("value"));
	}
};
JSXaalParserDS.getId = function(node) {
	var id = node.readAttribute("id");
	if (!id) {
		id = node.nodeName + JSXaal.Util.shapeCounter++;
	}
	return id;
};
JSXaalParserDS.handleStyle = function(viewer, xmlNode) {
	var styleId = xmlNode.readAttribute("x-style");
	if (styleId) {
		return viewer.styleStore[styleId];
	} else {
		var styles = xmlNode.getElementsByTagName("x-style");
		for (var i=0; i< styles.length; i++) {
			var style = styles[i];
			if (style && style.up() == xmlNode) {
				return JSXaalParserGP.parseStyle(style, viewer);
			}
		}
	}
};
JSXaalParserDS.renderKeyElement = function(viewer, keyNode) {
	if (keyNode.hasAttribute("value")) {
		data = keyNode.readAttribute("value");
	} else {
		data = JSXaal.Util.getContentsAsText(keyNode);
	}
	var key = new JSXaal.Key();
	key.setId(JSXaalParserDS.getId(keyNode));
	viewer.dsStore.set(key.getId(), key);
	key.setData(data);
	var style = JSXaalParserDS.handleStyle(viewer, keyNode);
	if (style) {
		key.setStyle(style);
	}
	return key;
};
var JSXaalMainParser = {};
JSXaalMainParser.register = function(parser) {
	parser.registerElementHandlerFunction("defs", JSXaalMainParser.renderDefsElement);
	parser.registerElementHandlerFunction("define-shape", JSXaalMainParser.renderShapeDefElement);
};
JSXaalMainParser.renderDefsElement = function(viewer, defsNode) {
	var children = defsNode.childElements();
	var length = children.length;
	for (var i = 0; i < length; i++) {
		viewer.parser.handleElement(children[i]);
	}
};
JSXaalMainParser.renderShapeDefElement = function (viewer, shapeDef) {
	var children = shapeDef.childElements();
	var shapes = new Array();
	children.each(function(item) {
		var shape = viewer.parser.handleElement(item);
		shapes.push(shape);
	});
	if (!viewer.shapes) {
		viewer.shapes = new Hash();
	}
	viewer.shapes[shapeDef.readAttribute("name")] = shapes;
};/** @file graphics.js */
/**
 * @class Style
 */
Style = Class.create({
	/**
	 * Constructor
	 * @function {public void} Style
	*/
	initialize: function() {
	},
	setId: function(id) {
		this.id = id;
	},
	getId: function() {
		return this.id;
	},
	/**
	 * @function {public void} ?
	 * @param {Object} color
	 */
	setColor: function(color) {
		this.color = color;
	},
	/**
	 * @function {public Color} ?
	 */
	getColor: function() {
		return this.color;
	},
	/**
	 * @function {public void} ?
	 * @param {Object} color
	 */
	setFillColor: function(color) {
		this.fillColor = color;
	},
	/**
	 * @function {public Color} ?
	 */
	getFillColor: function() {
		return this.fillColor;
	},
	setFontSize: function(size) {
		this.fontSize = size;
	},
	getFontSize: function() {
		return this.fontSize;
	},
	setFontFamily: function(family) {
		this.fontFamily = family;
	},
	getFontFamily: function() {
		return this.fontFamily;
	},
	setBold: function(bold) {
		this.bold = bold;
	},
	isBold: function() {
		return this.bold;
	},
	setItalic: function(italic) {
		this.italic = italic;
	},
	isItalic: function() {
		return this.italic;
	},
	getFontWeight: function() {
		var bold = this.isBold() || "false";
		return (bold == 'true')?'bold':'normal';
	},
	setStrokeWidth: function(width) {
		this.strokeWidth = width;
	},
	getStrokeWidth: function() {
		return this.strokeWidth;
	},
	setStrokeType: function(type) {
		this.strokeType = type;
	},
	getStrokeType: function() {
		return this.strokeType;
	},
	setBackwardArrow: function(bwArrow) {
		this.backwardArrow = bwArrow;
	},
	isBackwardArrow: function() {
		return this.backwardArrow || false;
	},
	setForwardArrow: function(fwArrow) {
		this.forwardArrow = fwArrow;
	},
	isForwardArrow: function() {
		return this.forwardArrow || false;
	},});
/** @file jsxaal-ui.js*/
JSXaal.UI = Class.create({
    initialize: function(elementId, viewer) {
        this.viewer = viewer;
        this.elemId = elementId;
        this.drawingId = elementId + "-drawing";
        this.createDrawingPanel();
        if (this.viewer.settings.isShowNarrative())
            this.createNarrativePanel();
        if (this.viewer.settings.isSettingsPanel())
            this.createSettingsPanel();
    },
    /**
     * @function {private void} ?
     */
    createNarrativePanel: function() {
        var elem = new Element("div", {id: this.elemId + "-narrative"});
        elem.addClassName("jsxaal-narrative");
        $(this.elemId).appendChild(elem);
        this.narrativeElem = elem;
    },
    /**
     * @function {private void} ?
     */
    createDrawingPanel: function() {
        var elem = new Element("div", {id: this.drawingId});
        elem.addClassName("jsxaal-drawing");
        $(this.elemId).appendChild(elem);
    },
    /**
     * @function {public void} ?
     * @param {Object} text
     */
    setNarrative: function(text) {
        if (!this.viewer.settings.isShowNarrative())
            return;
        if (!this.narrativeElem)
            this.createNarrativePanel();
        this.narrativeElem.update(text);
    },
    /**
     * @function {private void} ?
     */
    createSettingsPanel: function() {
        var elem = new Element("div", {id: this.elemId + "-settings"});
        elem.addClassName("jsxaal-settings");
        var form = new Element("form");
        elem.appendChild(form);
        form.appendChild(this._createCheckBoxElement(this.viewer.settings.isSmoothAnimation(), 'SmoothAnimation', 
        		'smooth animation'));
        var label = new Element("label");
        label.setAttribute('for', this.viewer.id + '-' + 'SmoothAnimation');
        label.appendChild(document.createTextNode(' smooth animation'));
        form.appendChild(label);
        this.viewer.toolbar.commands.each(function (item) {
            form.appendChild(item.value.create());
        });
        $(this.elemId).appendChild(elem);
    },
    /**
     * @function {private Element} ?
     * @param {Object} checked
     * @param {Object} name
     */
    _createCheckBoxElement: function(checked, name) {
        var elem = new Element('input', {type: 'checkbox', name: name, id: this.viewer.id + '-' + name});
        if (checked) {
            elem.checked = 'true';
        }
        elem.observe('click', this.viewer.settings['toggle' + name].bind(this.viewer.settings));
        return elem;
    },
    /**
     * @function {private void} ?
     * @param {Object} q
     */
    showQuestion: function(q) {
        var elem = $('jsxaal-interaction');
        if (!elem) {
            elem = new Element("div", {id: "jsxaal-interaction"});
            $$('body')[0].appendChild(elem);
        }
        elem.innerHTML = "";
        var shutter = $('shutter');
        if (!shutter) {
            shutter = new Element("div", {id: "shutter"});
            $$('body')[0].appendChild(shutter);
        }
        shutter.stopObserving('click');
        var question = new Element('div');
        question.update(q.getQuestionText());
        elem.appendChild(question);
        var form = new Element('form', {id: q.getId() + "-form"});
        elem.appendChild(form);
        var count = 0;
        q.getChoicesElements().each(function(item) {
            form.appendChild(item);
            if (count % 2 == 1) {
                form.appendChild(new Element("br"));
            }
            count++;

        });
        var answer = new Element('input', {type: "hidden", id: q.getId() + "-answer"});
        form.appendChild(answer);
        var butt = new Element('input', {id: q.getId() + "answerButton", type: "button", name: "answer", value: "Answer"});
        butt.observe('click', function(e){ this.answerQuestion(q);}.bind(this));
        form.appendChild(butt);
        elem.style.display = 'inline';
        shutter.style.display='inline';
    },
    /**
     * @function {private void} ?
     * @param {Object} q
     */
    answerQuestion: function(q) {
        var answer = $(q.getId() + "-answer").value; 
        q.setAnswer(answer);
        var clazz = "jsxaal-correct";
        if (!q.isCorrect()) {
            clazz = "jsxaal-wrong";
        }
        var feedback = new Element('div');
        feedback.addClassName(clazz);
        if (q.isCorrect() && !(q instanceof JSXaal.Question.Select)) {
            feedback.innerHTML = "Correct!";
        } else if (!(q instanceof JSXaal.Question.Select)){
            feedback.innerHTML = "Wrong";
        } else {
            feedback.innerHTML = "Grade: " + q.getGrade();
        }
        var closeButt = new Element('input', {type: "button", name: "submit", value: "Close"});
        closeButt.observe('click', function(evt) {this.closeQuestion(q);}.bind(this));
        if (q.viewer.settings.isStoreQuestionAnswers()) {
            var answerElem = new Element('student-answer', {answer: q.getAnswer()});
            q.getXmlNode().appendChild(answerElem);
            if (q.viewer.getServerInterface()) {
                q.viewer.getServerInterface().questionAnswered(q);              
            }
        }
        $('shutter').observe('click', function(evt) {this.closeQuestion(q);}.bind(this));
        var form = $(q.getId() + "-form");
        form.removeChild(form.lastChild);
        form.appendChild(feedback);
        form.appendChild(closeButt);
    },
    /**
     * @function {private void} ?
     * @param {Object} q
     */
    closeQuestion: function(q) {
        $('shutter').hide();
        $('jsxaal-interaction').hide();
        q.viewer.toolManager.setTool(null);
    }
});

JSXaal.UI.Toolbar = Class.create({
    /**
     * Constructor
     * @function {public void} JSXaal.UI.Toolbar
     * @param {Object} viewer
     */
    initialize: function(viewer) {
        this.viewer = viewer;
        this.commands = new Hash();
        this.created = false;
    },
    /**
    * @function {public void} ?
    * @param {Object} viewer
    */
    create: function() {
        this.commands.each(function(item) {
            item.value.create();
        });
        this.created = true;
    },
    /**
     * @function {public void} ?
     * @param {Object} name
     * @param {Object} obj
     */
    addCommand: function(name, obj) {
        this.commands.set(name, obj);
        if (this.created) {
            this.create();
        }
    }
});/**
 * Class offering utility methods for rendering parts of data structures, namely
 * structure "frames", nodes, and edges.
 * @class JSXaalRenderer
 */
var JSXaalRenderer = new Object();
JSXaalRenderer.counter = 0;
JSXaalRenderer.NODEGAP = 20;
JSXaalRenderer.renderNode = function(renderer, node, group) {
	var x = node.getPosition().x;
	var y = node.getPosition().y;
	var rect = new Graphic.Rectangle(renderer);
	rect.setID(group.getID() + "shape" + (JSXaalRenderer.counter++));
	rect.setBounds(x, y, NODESIZE, NODESIZE);
	JSXaalRenderer.setNodeStyle(rect, node.getStyle());
	group.add(rect);
	var text = new Graphic.Text(renderer);
	text.setID(group.getID() + "shape" + (JSXaalRenderer.counter++));
   	text.setFill({r: 0, g: 0, b: 0});
   	text.setStroke({r: 0, g: 0, b: 0});
	JSXaalRenderer.setKeyStyle(text, node.getData().getStyle());
   	text.setLocation(x-5+NODESIZE/2,Number(y)+5+NODESIZE/2);
	text.moveToFront();
	text.setTextValue(node.getData().getData());
	group.add(text);
};
JSXaalRenderer.drawFrame = function(x, y, width, height, renderer, group, title) {
	var bgRect = new Graphic.Rectangle(renderer);
	bgRect.setID("bgshape" + (JSXaalRenderer.counter++));
	bgRect.setBounds(x, y, width, height);
	bgRect.setFill({r: 223, g: 223, b: 223, a: 60});
	bgRect.setRoundCorner(5, 5);
	group.add(bgRect);
	var text = new Graphic.Text(renderer);
	text.setID("bgshape" + (JSXaalRenderer.counter++));
	text.setTextValue(title);
	text.setFont(12, "normal");
	text.setFill({r: 0, g: 0, b: 0});
	text.setStroke({r: 0, g: 0, b: 0});
	text.setLocation(x+5,y+15);
	group.add(text);
	var line = new Graphic.Line(renderer);
	line.setID("bgshape" + (JSXaalRenderer.counter++));
	line.setStroke({r: 0, g: 0, b: 0, w: 1.5});
	line.setPoints(x + 5, y+17, width + x - 5, y + 17);
	group.add(line);
};
/**
 * Applies the given style to the given shape. If no style is given, default
 * values specified in the JSXaal CSS will be used.
 * @function {public void} ?
 * @param {Object} shape
 * @param {Object} style
 */
JSXaalRenderer.setNodeStyle = function(shape, style) {
	shape.setFill({r: 128, g: 128, b: 128, a: 255});
	shape.setStroke({r: 0, g: 0, b: 0, w: 1.2});		
	shape.setRoundCorner(10, 10);
	JSXaalRenderer.util.setDefaultStyle(shape, "node");
	if (style) {
		JSXaalRenderer.setShapeStyle(shape, style);
	}
};
JSXaalRenderer.setShapeStyle = function(shape, style) {
	if (style && shape) {
		if (style.getColor()) {
			shape.setStroke(style.getColor());
		}
		if (style.getFillColor()) {
			shape.setFill(style.getFillColor());
		}
		if (style.getStrokeWidth()) {
			shape.setStrokeWidth(style.getStrokeWidth());
		}
	}
};
JSXaalRenderer.setKeyStyle = function(textShape, style) {
	textShape.setFill({r: 0, g: 0, b:0});
	if (textShape.setFont) {
		textShape.setFont(16, 'SansSerif');
	}
	if (style) {
		if (style.getColor() && style.getFillColor() && style.getColor() != style.getFillColor()) {
			textShape.setStroke(style.getColor());
			if (style.getFillColor()) {
				textShape.setFill(style.getFillColor());
			}
		} else if (!style.getColor() && style.getFillColor()) {
			textShape.setFill(style.getFillColor());
		} else {
			textShape.setFill(style.getColor());
		}
		var size = style.getFontSize() || 16;
		var family = style.getFontFamily() || 'SansSerif';
		var weight = style.getFontWeight();
		textShape.setFont(size, family, weight);
	}
};
JSXaalRenderer.renderEdge = function(from, to, edge, group) {
	var fromX = Number(from.getPosition().x);
	var fromY = Number(from.getPosition().y);
	var toX = Number(to.getPosition().x);
	var toY = Number(to.getPosition().y);
	var fromAngle = JSXaalRenderer.util.normalizeAngle(2*Math.PI -
                    Math.atan2(toY - fromY, toX - fromX));
    var toAngle = JSXaalRenderer.util.normalizeAngle(2*Math.PI -
                    Math.atan2(fromY - toY, fromX - toX));

    var fromPoint = JSXaalRenderer.util.getNodeBorderAtAngle(from, fromAngle);
    var toPoint = JSXaalRenderer.util.getNodeBorderAtAngle(to, toAngle);
	var line = new Graphic.Line(group.renderer);
	line.setID("jsxaaledge" + (JSXaalRenderer.counter++));
	JSXaalRenderer.util.setEdgeStyle(line, edge.getStyle());
   	line.setPoints(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y);
   	group.add(line);
	if (edge.isDirected()) {
		JSXaalRenderer.renderArrow(fromPoint, toPoint, "jsxaaledge"+(JSXaalRenderer.counter++),
				edge.getStyle(), group);
	}
};
JSXaalRenderer.renderArrow = function(fromPoint, toPoint, id, style, group) {
    var toAngle = JSXaalRenderer.util.normalizeAngle(2*Math.PI -
                    Math.atan2(fromPoint.y - toPoint.y, fromPoint.x - toPoint.x));
    var polyg = new Graphic.Polygon(group.renderer);
    polyg.setID(id);
	JSXaalRenderer.util.setEdgeStyle(polyg, style, true);
	polyg.addPoint(toPoint.x, toPoint.y);
	var angle = toAngle - Math.PI/6;
	var arrowSize = 4;
	polyg.addPoint(toPoint.x + (Math.cos(angle) * arrowSize), toPoint.y - (Math.sin(angle) * arrowSize));
	angle = toAngle + Math.PI/6;
	polyg.addPoint(toPoint.x + (Math.cos(angle) * arrowSize), toPoint.y - (Math.sin(angle) * arrowSize));
	group.add(polyg);
};
/**
 * Utility methods for the class JSXaalRenderer.
 * @class JSXaalRenderer.util
 * @see JSXaalRenderer
 */
JSXaalRenderer.util = new Object();
JSXaalRenderer.util.setEdgeStyle = function(shape, style, setfill) {
	shape.setStroke({r: 0, g: 0, b: 0, w: 1.2});
	JSXaalRenderer.setShapeStyle(shape, style);
};
/**
 * Function that sets the style of the shape to use the default values specified
 * in the CSS attached to the HTML document.<br/> 
 * 
 * The second (and any additional) parameter specifies the css classes used when
 * selecting the values. The structureType should specify the type of the structure.
 * This value is used in the CSS classname. For example, giving structureType value
 * <em>node</em> will use CSS class <code>jsxaal-node</code>.<br/>
 * 
 * The properties that are currently used are:
 * <ol>
 *  <li><code>color</code> that sets the stroke of the shape</li> 
 *  <li><code>background-color</code> that sets the fill of the shape</li>
 * </ol> 
 * @function {public void} ?
 * @param {Graphic.Shape} shape
 * @param {Object...} structureType
 */
JSXaalRenderer.util.setDefaultStyle = function(shape, structureType) {
	var cssRule = ".jsxaal-" + structureType;
	for (var i=2; i<arguments.length; i++) {
		cssRule += " .jsxaal-" + arguments[i];
	};
	var node = $$(cssRule);
	var elem = null;
	if (node.length == 0) {
		elem = new Element('div', {style: 'display:none'});
		for (var i=1; i<arguments.length; i++) {
			elem.addClassName('jsxaal-'+arguments[i]);
		}
		$$('body')[0].appendChild(elem);
	} else {
		elem = node[0];
	}
	shape.setStroke(JSXaal.Util.colorstringToHash(Element.getStyle(elem, 'color')));
	shape.setFill(JSXaal.Util.colorstringToHash(Element.getStyle(elem, 'background-color')));
};
JSXaalRenderer.util.normalizeAngle = function(angle) {
	while (angle < 0)
            angle += 2 * Math.PI;
        while (angle >= 2 * Math.PI)
            angle -= 2 * Math.PI;
        return angle;
};
JSXaalRenderer.util.getNodeBorderAtAngle = function(node, angle) {
	var b = {x: node.getPosition().x, y: node.getPosition().y, width: NODESIZE, height: NODESIZE};
	var c = {x: b.x + NODESIZE/2, y: b.y + NODESIZE/2};
        var x, y;
        var urCornerA = Math.atan2(b.height, b.width);
        var ulCornerA = Math.PI - urCornerA;
        var lrCornerA = 2*Math.PI - urCornerA;
        var llCornerA = urCornerA + Math.PI;

        if (angle < urCornerA || angle > lrCornerA) { // on right side
            x = b.x + b.width;
            y = c.y - (b.width/2.0) * Math.tan(angle);
        } else if (angle > ulCornerA && angle < llCornerA) { // left
            x = b.x;
            y = c.y + (b.width/2.0) * Math.tan(angle - Math.PI);
        } else if (angle <= ulCornerA) { // top
            x = c.x + (b.height/2.0) / Math.tan(angle);
            y = b.y;
        } else { // on bottom side
            x = c.x - (b.height/2.0) / Math.tan(angle - Math.PI);
            y = b.y + b.height;
        }
	return {x: Math.round(x), y: Math.round(y)};
};
JSXaalRenderer.util.getGraphLayout = function(viewer, graph) {
	var graphStr = '';
	graph.nodes.each(function(item) {
		item.value.successors.each(function(succ) {
			graphStr += item.key + '-' + succ.node.getId() + ",";
		});
	});
	debug(graphStr);
	debug(graphStr.escapeHTML());
	debug(encodeURIComponent(graphStr));
	JSXaalRenderer.util.getJSON('http://gd.villekaravirta.com/draw/?graph=' +
			encodeURIComponent(graphStr) + 'a-b%2Cb-c&key=demo&jsoncallback=?', 
			graph.setCoordinateData.bind(graph, viewer), graph.getId());//function(data) {debug(data['coordinates']['a'].x);});
};
(function(){
	  var id = 0, head = $$('head')[0], global = this;
	  JSXaalRenderer.util.getJSON = function(url, callback, graphId) {
	    var script = document.createElement('script'), token = '__jsoncallback' + id;
	    
	    // callback should be a global function
	    global[token] = callback;
	    
	    // url should have "?" parameter which is to be replaced with a global callback name
	    script.src = url.replace(/\?(&|$)/, '__jsoncallback' + id + '$1');
	    // clean up on load: remove script tag, null script variable and delete global callback function
	    script.onload = function() {
	      script.remove();
	      script = null;
	      delete global[token];
	    };
	    head.appendChild(script);
	    id++;
	  }
	})();Effect.XaalOpacity = Class.create(Effect.Base, {
  initialize: function(element, viewer) {
    this.viewer = viewer;
    this.element = this.viewer.renderer.get(element);
    var options = Object.extend({
      fill: (this.element.getFill() != 'none'),
      stroke: (this.element.getStroke() != 'none'),
      from: 255.0,
      to:   1.0
    }, arguments[2] || { });
    this.start(options);
  },
  update: function(position) {
  	if (this.options.fill) {
		this.element.setFillOpacity(position);
	}
	if (this.options.stroke) {
		this.element.setStrokeOpacity(position);
	}
  }
});
/**
 * @class Effect.XaalMove
 */
Effect.XaalMove = Class.create(Effect.Base, {
  initialize: function(element, viewer) {
    this.viewer = viewer;
    this.element = this.viewer.renderer.get(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      x:    0,
      y:    0,
      mode: 'relative'
    }, arguments[2] || { });
    this.start(options);
  },
  setup: function() {
    this.originalLeft = parseFloat(this.element.getLocation().x || '0');
    this.originalTop  = parseFloat(this.element.getLocation().y || '0');
    if (this.options.mode == 'absolute') {
      this.options.x = this.options.x - this.originalLeft;
      this.options.y = this.options.y - this.originalTop;
    }
  },
  update: function(position) {
    	this.element.setLocation(Math.round(position*this.options.x + this.originalLeft),
    	(this.options.y  * position + this.originalTop).round());
  }
});

/**
 * A scale effect.
 * @class Effect.XaalScale
 */
Effect.XaalScale = Class.create(Effect.Base, {
	/**
	 * @function {public void} ?
	 * @param {Object} element
	 * @param {Object} viewer
	 */
  initialize: function(element, viewer) {
    this.viewer = viewer;
    this.element = this.viewer.renderer.get(element);
    if (!this.element) {
	throw (Effect._elementDoesNotExistError);
    }
    var options = Object.extend({
      scaleFrom: 1.0,
      scaleTo:   1.0
    }, arguments[2] || { });
    this.start(options);
  },
  /**
   * @function {public void} ?
   */
  setup: function() {
    this.factor = (this.options.scaleTo - this.options.scaleFrom);
    this.currentScale = this.options.scaleFrom;
    var bounds = this.element.getBounds();
    this.cx = bounds.x + bounds.w/2.0;
    this.cy = bounds.y + bounds.h/2.0;
  },
  update: function(position) {
    var fact = 1.0 + this.factor*position;
    var newScale = fact/this.currentScale;
    this.currentScale = fact;
    this.element.scale(newScale, newScale, this.cx, this.cy);
  }
});

/**
 * @class Effect.XaalRotate
 */
Effect.XaalRotate = Class.create(Effect.Base, {
  initialize: function(element, viewer) {
    this.viewer = viewer;
    this.element = this.viewer.renderer.get(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      cx:    -1,
      cy:    -1,
      degree: 45
    }, arguments[2] || { });
    this.start(options);
  },
  setup: function() {
    this.currRot = 0;
    this.hasCoords = false;
    if (this.options.cx != -1) {
      this.hasCoords = true;
    } 
  },
  update: function(position) {
    var newRot = this.options.degree*position;
    if (this.options.cx != -1) {
      this.element.rotate(newRot - this.currRot, this.options.cx, this.options.cy);
    } else {
      this.element.rotate(newRot - this.currRot);
    }
    this.currRot = newRot;
  }
});

/**
 * Changes the style of an element.
 * @param {String} element
 * @param {JSXaalViewer} viewer
 */
Effect.XaalMorph = Class.create(Effect.Base, {
  initialize: function(element, viewer) {
    this.viewer = viewer;
    this.element = this.viewer.renderer.get(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      style: { }
    }, arguments[2] || { });
    
    if (!Object.isString(options.style)) { 
    	this.style = $H(options.style);
	//debug("ns:"+options.style + " " + this.style);
    } else {
    	//debug("string");
      if (options.style.include(':'))
        this.style = options.style.parseStyle();
      /*else {
        this.element.addClassName(options.style);
        this.style = $H(this.element.getStyles());
        this.element.removeClassName(options.style);
        var css = this.element.getStyles();
        this.style = this.style.reject(function(style) {
          return style.value == css[style.key];
        });
        options.afterFinishInternal = function(effect) {
          effect.element.addClassName(effect.options.style);
          effect.transforms.each(function(transform) {
            effect.element.style[transform.style] = '';
          });
        }
      }*/
    }
    this.start(options);
  },
  
  setup: function(){
    function parseColor(color){
      if (!color || ['rgba(0, 0, 0, 0)','transparent'].include(color)) color = '#ffffff';
      color = color.parseColor();
      return $R(0,2).map(function(i){
        return parseInt( color.slice(i*2+1,i*2+3), 16 ) 
      });
    }
    function getOriginal(property, elem) {
    	if (property == 'color') {
		return elem.getStroke();
	} else if (property == 'fillcolor') {
		return elem.getFill();
	}
    }
    //debug("s:"+this.style);
    this.transforms = this.style.map(function(pair){
      var property = pair[0], value = pair[1], unit = null;
	//debug(property+":"+value);
      if (value.parseColor('#zzzzzz') != '#zzzzzz') {
        value = value.parseColor();
        unit  = 'color';
      }/* else if (property == 'opacity') {
        value = parseFloat(value);
        if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
          this.element.setStyle({zoom: 1});
      } else if (Element.CSS_LENGTH.test(value)) {
          var components = value.match(/^([\+\-]?[0-9\.]+)(.*)$/);
          value = parseFloat(components[1]);
          unit = (components.length == 3) ? components[2] : null;
      }*/
	//debug("value:"+value);
      var originalValue = getOriginal(property, this.element);//this.element.getStyle(property);
      return { 
        style: property,//.camelize(), 
        originalValue: unit=='color' ? parseColor(originalValue) : parseFloat(originalValue || 0), 
        targetValue: unit=='color' ? parseColor(value) : value,
        unit: unit
      };
    }.bind(this)).reject(function(transform){
      return (
        (transform.originalValue == transform.targetValue) ||
        (
          transform.unit != 'color' &&
          (isNaN(transform.originalValue) || isNaN(transform.targetValue))
        )
      )
    });
    //debug("trans:"+this.transforms);
  },
  update: function(position) {
  	//return;
    var style = { }, transform, i = this.transforms.length;
    //debug(i);
    while(i--) {
      /*style[(transform = this.transforms[i]).style] = 
        transform.unit=='color' ? '#'+
          (Math.round(transform.originalValue[0]+
            (transform.targetValue[0]-transform.originalValue[0])*position)).toColorPart() +
          (Math.round(transform.originalValue[1]+
            (transform.targetValue[1]-transform.originalValue[1])*position)).toColorPart() +
          (Math.round(transform.originalValue[2]+
            (transform.targetValue[2]-transform.originalValue[2])*position)).toColorPart() :
        (transform.originalValue +
          (transform.targetValue - transform.originalValue) * position).toFixed(3) + 
            (transform.unit === null ? '' : transform.unit);*/
	   //debug("transform:" + this.transforms[i].style);
	   transform = this.transforms[i];
	   if (this.transforms[i].style=='color') {
	   /*	debug((Math.round(transform.originalValue[0]+
            (transform.targetValue[0]-transform.originalValue[0])*position)));*/
	   	this.element.setStroke({r: Math.round(transform.originalValue[0]+
            (transform.targetValue[0]-transform.originalValue[0])*position),
	    	g: Math.round(transform.originalValue[1]+
            (transform.targetValue[1]-transform.originalValue[1])*position),
	    	b: Math.round(transform.originalValue[2]+
            (transform.targetValue[2]-transform.originalValue[2])*position)});
	   } else if (transform.style=='fillcolor') {
	   	this.element.setFill({r: Math.round(transform.originalValue[0]+
            (transform.targetValue[0]-transform.originalValue[0])*position),
	    	g: Math.round(transform.originalValue[1]+
            (transform.targetValue[1]-transform.originalValue[1])*position),
	    	b: Math.round(transform.originalValue[2]+
		(transform.targetValue[2]-transform.originalValue[2])*position)});   	
	   }
    }
    //this.element.setStyle(style, true);
  }
})

/**
 * @namespace JSXaal.Question
 */
JSXaal.Question = new Object();
/**
 * An abstract superclass of all questions in JSXaal.
 * @class {abstract} JSXaal.Question.AbstractQuestion
 */
JSXaal.Question.AbstractQuestion = Class.create({
	initialize: function(id, viewer, qType) {
		this.displayed = false;
		this.qquestionType = qType;
		this.id = id;
		this.viewer = viewer;
	},
	isDisplayed: function(){
		return this.displayed;
	},
	setDisplayed: function(){
		this.displayed = true;
	},
	getQuestionType: function() {
		return this.questionType;
	},
	setCorrectAnswer: function(correct) {
		this.correct = correct;
	},
	setAnswer: function(answer) {
		this.answer = answer;
	},
	getAnswer: function() {
		return this.answer;
	},
	isCorrect: function() {
		if (!this.answer) {
			return false;
		} else {
			debug("ERROR: Unimplemented method JSXaal.Question.AbstractQuestion.isCorrect")
		}
	},
	isCorrectAnswer: function(answer) {
		this.setAnswer(answer);
		return this.isCorrect();
	},
	setQuestionText: function(question) {
		this.question = question;
	},
	getQuestionText: function() {
		return this.question;
	},
	getId: function() {
		return this.id;
	},
	addAnswerOption: function(item) {
		console.log("ERROR: Unimplemented method JSXaal.Question.AbstractQuestion.addAnswerOption");
	},
	getChoicesElements: function() {
		console.log("ERROR: Unimplemented method JSXaal.Question.AbstractQuestion.getChoicesElements");
	},
	setXmlNode: function(node) {
		this.xmlnode = node;
	},
	getXmlNode: function() {
		return this.xmlnode;
	}
});
JSXaal.Question.Item = Class.create({
	initialize: function(id) {
		this.id = id;
	},
	setAnswer: function(answer) {
		this.answer = answer;
	},
	getAnswer: function() {
		return this.answer;
	},
	setFeedback: function(feedback) {
		this.feedback = feedback;
	},
	getFeedback: function() {
		return this.feedback;
	},
	getId: function() {
		return this.id;
	},
	setGrade: function(value) {
		this.grade = Number(value);
	},
	getGrade: function() {
		return this.grade;
	}
});
/**
 * A question where one of the given choices can be selected.
 * @class JSXaal.Question.SelectOne @extends JSXaal.Question.AbstractQuestion
 */
JSXaal.Question.SelectOne = Class.create(JSXaal.Question.AbstractQuestion, {
	initialize: function($super, id, viewer){
		$super(id, viewer, "select-one");
		this.options = new Array();
	},
	addAnswerOption: function(item) {
		this.options.push(item);
	},
	isCorrect: function() {
		return (this.answer == this.correct.getId());
	},
	getChoicesElements: function() {
		var elems = new Array();
		for (var index = 0, len = this.options.length; index < len; ++index) {
 			var item = this.options[index];
			elems[2*index] = new Element('input', {type: "radio", name: this.getId() + "group", value:"true", onclick: "$('" + this.getId() + "-answer').value='"+item.getId()+"';"});
			elems[2*index+1] = new Element('span');
			elems[2*index+1].innerHTML = item.getAnswer();
		}
		return elems;
	}
});
/**
 * A question where any number of the given choices can be selected.
 * @class JSXaal.Question.Select @extends JSXaal.Question.AbstractQuestion
 */
JSXaal.Question.Select = Class.create(JSXaal.Question.AbstractQuestion, {
	initialize: function($super, id, viewer){
		$super(id, viewer, "select");
		this.options = new Array();
	},
	addAnswerOption: function(item) {
		this.options.push(item);
	},
	isCorrect: function() {
		return (this.getGrade() > 0);
	},
	getChoicesElements: function() {
		var elems = new Array();
		for (var index = 0, len = this.options.length; index < len; ++index) {
 			var item = this.options[index];
			elems[2*index] = new Element('input', {type: "checkbox", id: this.getId() + item.getId(), name: this.getId() + "group"});
			elems[2*index+1] = new Element('span');
			elems[2*index+1].innerHTML = item.getAnswer();
		}
		return elems;
	},
	getAnswer: function() {
		var answer = "";
		for (var index = 0, len = this.options.length; index < len; ++index) {
 			var item = this.options[index];
			var itemElem = $(this.getId() + item.getId());
			if (itemElem.checked) {
				answer += " " + item.getId();
			}
		}
		return answer;
	},
	getGrade: function() {
		var grade = 0;
		for (var index = 0, len = this.options.length; index < len; ++index) {
 			var item = this.options[index];
			var itemElem = $(this.getId() + item.getId());
			if (itemElem.checked) {
				grade += item.getGrade();
			}
		}
		return grade;
	}
});var JSAnimatorStore = {};
var JSXaalAnimatorCount = 0;
/**
 * Animator for the JSXaal viewer.
 * <b>TODO:</b> Move to JSXaal.Animator
 * @class JSAnimator
 */
var JSAnimator = Class.create({
	/**
	 * @function {public void} JSAnimator
	 * @param {Object} viewer
	 */
	initialize: function(viewer) {
		this.viewer = viewer;
		this.id = "jsxaal-animator-" + JSXaalAnimatorCount;
		JSXaalAnimatorCount++;
		this.backwardStack = new Array();
		this.forwardStack = new Array();
		this.fwButton = null;
		this.bwButton = null;
		this.rwButton = null;
		// for smooth animation
		this.effects = new Array();
		this.queue = null;
		this.minStepViewer = 0;
		this.maxStepViewer = 0;
	},
	/**
	 * @function {public void} ?
	 * @param {Object} shapeId
	 * @param {Object} effectName
	 * @param {Object} options
	 */
	addEffect: function(shapeId, effectName, options) {
		if (!shapeId) {
			return;
		}
		this.effects.push([effectName,shapeId,options]);
	},
	/**
	 * Sets the operation stack of this animator.
	 * @function {public void} ?
	 * @param {Object} xaalNode
	 */
	setAnimation: function(arrayOfNodes) {
		this.forwardStack = arrayOfNodes;
		this.updateControls();
		this.createSlider();
	},
	/**
	 * Moves forward in the animation if such state exists.
	 * @function {public void} ?
	 */
	forward: function() {
		this.disableControls();
		o = this.forwardStack.pop();
		if (o) {
			try {
				this.viewer.parser.handleElement(o);
			} catch (e) {
				debug("" + e);
			}
		}
		this.backwardStack.push(o);
		this.applyEffects();
		setTimeout(this.updateControls.bind(this), 500);
		this.effects = new Array();
		this.viewer.ui.setNarrative(this.narrativeText);
		this.narrativeText = "";
		if (this.viewers) {
			this.viewers.each(function(item) {
				var step = Number(item.key);
				if ((step + this.backwardStack.size()) == 0) {
					item.value.renderInitialElement(item.value.animator.initial);
				} else if (step + this.backwardStack.size() > 0 && step <= this.forwardStack.size()) {
					item.value.animator.forward();
				} else {
					item.value.renderer.clear();
				}
			}.bind(this));
		}
	},
	/**
	 * Moves backward in the animation if such state exists.
	 * @function {public void} ?
	 */
	backward: function() {
		this.disableControls();
		var pos = this.backwardStack.size();
		this.rewind();
		var oldSmooth = this.viewer.settings.isSmoothAnimation();
		if (oldSmooth) {
			this.viewer.settings.toggleSmoothAnimation();
		}
		while (pos > 1) {
			this.forward();
			pos--;
		}
		if (oldSmooth) {
			this.viewer.settings.toggleSmoothAnimation();
		}
	},
	/**
	 * Rewinds the animator.
	 * @function {public void} ?
	 */
	rewind: function() {
		this.disableControls();
		while (this.backwardStack.size() > 0) {
			this.forwardStack.push(this.backwardStack.pop());
		}
		this.viewer.renderer.clear();
		this.viewer.renderInitialElement(this.initial);
		this.updateControls();
		if (this.viewers) {
			this.viewers.each(function(item) {
				item.value.animator.rewind();
				var step = Number(item.key);
				if (step < 0) {
					item.value.renderer.clear();
				} else if (step > 0) {
					for (var i=0; i<step; i++) {
						item.value.animator.forward();
					}
				}
			});
		}
	},
	refresh: function() {
		if (this.backwardStack.size() == 0) {
			this.viewer.renderer.clear();
			this.viewer.renderInitialElement(this.initial);
		}
		this.backward();
		this.forward();
	},
	/**
	 * Sets the animator control buttons enabled/disabled depending on the
	 * state of the animator.
	 * @function {private void} ?
	 */
	updateControls: function() {
		var disabled = false;
		if (!this.backwardStack || this.backwardStack.size() === 0) {
			disabled = true;
            if (this.rwButton) {
                this.rwButton.disable();
            }
            if (this.bwButton) {
                this.bwButton.disable();
            }
		} else {
    		if (this.rwButton) {
    			this.rwButton.enable();
    		}
    		if (this.bwButton) {
    			this.bwButton.enable();
    		}
        }
		disabled = false;
		if (!this.forwardStack || this.forwardStack.size() === 0) {
			disabled = true;
            if (this.fwButton) {
                this.fwButton.disable();
            }
		} else {
            if (this.fwButton) {
                this.fwButton.enable();
            }
        }
		if (this.progressBar) {
			this.progressBar.setSelection(this.backwardStack.size());
			var counter = $(this.id + '-counter');
			counter.update((this.backwardStack.size() + 1) + '/' + (this.backwardStack.size() +
				this.forwardStack.size() + 1));
		}
	},
	createSlider: function() {
		if (!this.viewer.settings.isShowAnimator()) {
			return;
		}
		try {
			this.progressBar = new ProgressBar(this.id + '-slider', {classProgressBar: 'jsxaal-sliderelem', style: ProgressBar.DETERMINATE, maximum: this.backwardStack.length+this.forwardStack.length, selection: 0, color: {r: 128, g: 128, b: 128}});
				var counter = $(this.id + '-counter');
				counter.update('1/' + (this.backwardStack.size() +
					this.forwardStack.size() + 1));
		} catch(exp) {
			$(this.id + '-slider').remove();
		}
	},
	/**
	 * Disables all controls of the animator.
	 * @function {private void} ?
	 */
	disableControls: function() {
		if (this.rwButton) {
			this.rwButton.disable();
		}
		if (this.bwButton) {
			this.bwButton.disable();
		}
		if (this.fwButton) {
			this.fwButton.disable();
		}
	},
	/**
	 * @function {private void} ?
	 */
	applyEffects: function() {
		var eff = "";
		var effCount = 0;
		var parCount = 0;
		var length = this.effects.size();
		for (var i = 0; i<length;i++) {
			if (this.effects[i][1] == 'startpar') {
				if (effCount !== 0) {
					eff += ";";
				}
				eff += "new Effect.Parallel([";
			} else if (this.effects[i][1] == 'endpar') {
				eff += "]";
				eff += ", {afterFinish:function() {";

				//eff +=");";
				parCount++;
				effCount = 0;
			} else if (this.effects[i][0] == 'draw') {
				eff += "this.viewer.dsStore.get('" + this.effects[i][1] + "').draw(this.viewer.renderer);";
			} else {
				if (effCount !== 0) {
					eff += ",";
				}
				effCount++;
				eff += "new Effect." + this.effects[i][0];
				eff += "('" + this.effects[i][1] + "', JSXaalViewerStore['" +this.viewer.ui.elemId + "']," + this.effects[i][2] + ")";
			}
		}
		while (parCount--) {
			eff += "}})";
		}
		eff += ";";
		//debug(eff);
		eval(eff);
		//alert("aply "+this.effects.size()+" "+eff);
	},
	/**
	 * @function {private void} ?
	 * @param {Object} elemId
	 */
	createPanel: function(elemId){
		if (!this.viewer.settings.isShowAnimator()) {
			return;
		}
		var el = $(elemId);
		if (!el) {
			el = new Element("div", {id: elemId});
			var parent = $(this.viewer.ui.elemId);
			parent.insertBefore(el, parent.firstChild);
		}
		el.addClassName('jsxaal-animation-panel');
		var slider = new Element('div', {id: this.id + '-slider'});
		slider.addClassName('jsxaal-slider');
		el.insert(slider);
		var counter = new Element('span', {id: this.id + '-counter'});
		counter.addClassName('jsxaal-counter');
		counter.update('1');
		el.insert(counter);
		if (el) {
			JSAnimatorStore[this.id] = this;
			this.rwButton = new Element('input', {id: this.id + 'jsmatrix-rwb', type: 'button', value: 'Rewind', disabled: 'true' });
			this.rwButton.observe('click', function(e) {this.rewind();e.stop();}.bind(this));
			el.appendChild(this.rwButton);
			this.bwButton = new Element('input', {id: this.id + 'jsmatrix-bb', type: 'button', value: 'Backward', disabled: 'true' });
			this.bwButton.observe('click', function(e) {this.backward();e.stop();}.bind(this));
			el.appendChild(this.bwButton);
			this.fwButton = new Element('input', {id: this.id + 'jsmatrix-fb', type: 'button', value: 'Forward', disabled: 'true' });
			this.fwButton.observe('click', function(e) {this.forward();e.stop();}.bind(this));
			el.appendChild(this.fwButton);
		}
	},
	/**
	 * @function {public void} ?
	 * @param {Object} narrativeText
	 */
	setNarrative: function(narrativeText) {
		this.narrativeText = narrativeText;
	},
	/**
	 * @function {public void} ?
	 * @param {Object} element - an XML node describing the polygon element that was drawn.
	 */
	addAnnotation: function(element) {
		var node = this.backwardStack[this.backwardStack.length - 1];
		if (!node) {
			this.addStudentAnnotation(this.initial, element);
		} else {
			if (!(node.nodeName.toLowerCase() == 'seq' || node.nodeName.toLowerCase() == 'par')) {
				var elem = new Element('par');
				this.addStudentAnnotation(elem, element);
			} else {
				this.addStudentAnnotation(node, element);
			}
		}
	},
	/**
	 * Adds the annotation to the <texttt>&lt;student-annotation></texttt> element
	 * of the given <code>element</code>. If no student-annotation element exists, one
	 * will be created and appended to the element.
	 * @function {private void} ?
	 * @param {Object} element
	 * @param {Object} annotation
	 */
	addStudentAnnotation: function(element, annotation) {
		var stuAnn = element.getElementsByTagName("student-annotation");
		if (stuAnn.length > 0) {
			stuAnn = stuAnn[0];
			stuAnn.appendChild(annotation);
		} else {
			stuAnn = new Element('student-annotation');
			stuAnn.appendChild(annotation);
			element.appendChild(stuAnn);
		}
		if (this.viewer.getServerInterface()) {
			this.viewer.getServerInterface().annotationAdded(annotation);
		}
	},
	/**
	 * Stores the initial state of the animation to the animator. This is needed in
	 * rewinding the animation.
	 * @function {public void} ?
	 * @param {Object} initialElem
	 */
	setInitial: function(initialElem) {
		this.initial = initialElem;
	},
	addStepViewer: function(stepDiff, options) {
		if (!this.viewers) {
			this.viewers = new Hash();
		}
		var mainDrawingPanel = $(this.viewer.id + '-drawing');
		var elem = new Element('div', {id: this.viewer.id + stepDiff});
		elem.addClassName('jsxaal-additionalview');
		//debug(mainDrawingPanel.getWidth());
		var newHeight = options.scale*mainDrawingPanel.getHeight();
		elem.setStyle({width: options.scale*mainDrawingPanel.getWidth() + 'px', height:options.scale*mainDrawingPanel.getHeight() + 'px'});
		elem.setStyle({paddingTop: (mainDrawingPanel.getHeight() - newHeight)/2 + 'px'});

		if (stepDiff < 0) {
			mainDrawingPanel.insert({before: elem});
		} else {
			mainDrawingPanel.insert({after: elem});

		}
		var newSettings = Object.extend({}, this.viewer.settings.settings);
		newSettings = Object.extend(newSettings, {showAnimator: false, showNarrative: false, settingsPanel: false, smoothAnimate: false});
		var newOptions = {};
		newOptions = Object.extend(newOptions, this.viewer.options);
		newOptions = Object.extend(newOptions, options);
		var newViewer = new JSXaalViewer(this.viewer.id + stepDiff, newSettings, newOptions);
		elem.appendChild(document.createTextNode(options['title']));
		elem = $(newViewer.id + '-drawing');
		if (stepDiff < 0) {
			newViewer.renderer.clear();
		} else {
			for (var i = 0; i < stepDiff; i++) {
				newViewer.animator.forward();
			}
		}
		newViewer.renderer.zoom(options.scale, options.scale, 0.01, 0.01);//, elem.getWidth()/2, elem.getHeight()/2);
		this.viewers.set(stepDiff, newViewer);
		this.minStepViewer = Math.min(this.minStepViewer, stepDiff);
		this.maxStepViewer = Math.max(this.maxStepViewer, stepDiff);
	}
});
/**
 * This file contains the settings class for the JSXaal viewer.
 * @file jsxaal-viewersettings.js
 */
/**
 * <b>TODO:</b> rename to be JSXaal.Viewer.Settings
 * @class JSXaalViewerSettings
 */
var JSXaalViewerSettings = Class.create({
	/**
	 * @function {public void} JSXaalViewerSettings
	 * @param {Object} viewer
	 */
	initialize: function(viewer) {
		this.viewer = viewer;
		this.settings = Object.extend({
		      smoothAnimate:    false,
		      settingsPanel:	false,
		      showNarrative: 	true,
		      storeQuestionAnswers: true,
		      showAnimator:	true,
		      language:		'en'
		    }, arguments[1] || { });
		this.annotation = new JSXaal.UI.Toolbar.AnnotationColor(this.viewer);
		this.zoom = new JSXaal.UI.Toolbar.Zoom(this.viewer);
		this.lang = new JSXaal.UI.Toolbar.Language(this.viewer, this.settings.language);
		this.viewer.toolbar.addCommand("zoom", this.zoom);
		this.viewer.toolbar.addCommand("annotation", this.annotation);
		this.viewer.toolbar.addCommand("lang", this.lang);
	},
	/**
	 * @function {public boolean} ?
	 */
	isSmoothAnimation: function() {
		return this.settings.smoothAnimate;
	},
	/**
	 * @function {public void} ?
	 */
	toggleSmoothAnimation: function() {
		this.settings.smoothAnimate = !this.settings.smoothAnimate;
	},
	/**
	 * @function {public boolean} ?
	 */
	isSettingsPanel: function() {
		return this.settings.settingsPanel;
	},
	/**
	 * @function {public boolean} ?
	 */
	isShowNarrative: function() {
		return this.settings.showNarrative;
	},
	/**
	 * @function {public boolean} ?
	 */
	isShowAnimator: function() {
		return this.settings.showAnimator;
	},
	/**
	 * @function {public void} ?
	 */
	toggleDrawingTool: function() {
		this.settings.drawingTool = !this.settings.drawingTool;
		this.annotation.toggleDrawingTool();
	},
	/**
	 * @function {public boolean} ?
	 */
	isDrawingTool: function() {
		return this.settings.drawingTool;
	},
	/**
	 * @function {public boolean} ?
	 */
	isStoreQuestionAnswers: function() {
		return this.settings.storeQuestionAnswers;
	},
	/**
	 * @function {public void} ?
	 * @param {String} lang - the language to be added
	 */
	addLanguage: function(lang) {
		if (this.lang) {
			this.lang.addLanguage(lang);
		}
	},
	/**
	 * @function {public String} ?
	 */
	getLanguage: function() {
		if (this.lang) {
			return this.lang.lang;
		} else {
			return this.settings.language;
		}
	}
});
/**
 * A class that handles the annotation functionality.
 * @class JSXaal.UI.Toolbar.AnnotationColor
 */
JSXaal.UI.Toolbar.AnnotationColor = Class.create({
	/**
	 * Constructor for the class.
	 * @function {public void} ?
	 * @param {Object} viewer Viewer object
	 */
	initialize: function(viewer) {
		this.viewer = viewer;
		this.color = "black";
	},
	/**
	 * A method that creates the necessary html elements for this toolbar component.
	 * @function {public Element} ?
	 * @return element
	 */
	create: function() {
		var elem = new Element("span");
		elem.appendChild(this._createCheckBoxElement(this.viewer.settings.isDrawingTool(), 'DrawingTool'));
		//var checkDraw = new Element('span');
        var label = new Element("label");
        label.setAttribute('for', this.viewer.id + '-' + 'DrawingTool');
        //label.appendChild(document.createTextNode(' smooth animation'));
        label.appendChild(document.createTextNode("draw annotations"));
        elem.appendChild(label);
		//elem.appendChild(checkDraw);
		var sel = new Element("select");
		sel.observe('change', this.colorChanged.bind(this));
		
		JSXaal.Util.colorNames.each(function (item, index) {
			var col = document.createElement("option");
			col.style.background = item.key;
			col.innerHTML = "&nbsp;" + item.key;
			col.value = item.key;
			if (item.key == 'black') {
				col.selected = "selected";
				sel.style.background=item.key;
				col.style.color = "white";
			}
			sel.appendChild(col);
		});
		this.sel = sel;
		elem.appendChild(this.sel);
		return elem;
	},
	/**
	 * @function {private String} ?
	 * @param {Object} checked
	 * @param {Object} name
	 */
	_createCheckBoxElement: function(checked, name) {
		var elem = new Element('input', {type: 'checkbox', name: name, id: this.viewer.id + '-' + name});
		if (checked) {
			elem.checked = 'true';
		}
		elem.observe('click', this.viewer.settings['toggle' + name].bind(this.viewer.settings));
		return elem;
	},
	/**
	 * Method called when value in the checkbox changes.
	 * @function {public void} ?
	 * @param evt The event
	 */
	colorChanged: function(evt) {
		var elem = evt.element();
		elem.style.background = elem.value;
		this.color = elem.value;
		if (this.viewer.settings.isDrawingTool()) {
			this.viewer.toolManager.getTool().setStroke(JSXaal.Util.colorNames.get(this.color));
		}
	},
	/**
	 * @function {public void} ?
	 */
	toggleDrawingTool: function() {
		if (!this.color) {
			this.color = "black";
		}
		var currTool = this.viewer.toolManager.getTool();
		if (this.viewer.settings.isDrawingTool()) {
			if (currTool instanceof Graphic.DrawingTool) {
				currTool.setStroke(JSXaal.Util.colorNames.get(this.color));
				currTool.activate(this.viewer.toolManager);
			} else {
				var newTool = new Graphic.DrawingTool();
				newTool.endDrag = this.endDrag.bind(this);
				newTool.setStroke(JSXaal.Util.colorNames.get(this.color));
				this.viewer.toolManager.setTool(newTool);
			}
		} else {
			var currTool = this.viewer.toolManager.getTool();
			if (currTool instanceof Graphic.DrawingTool) {
				currTool.unactivate(this.viewer.toolManager);
			}
		}
	}, 
	/**
	 * @function {public void} ?
	 */
	endDrag: function() {
		var polyline = this.viewer.toolManager.getTool().polyline;
		this.viewer.toolManager.getTool().polyline = null;
		var elem = new Element('polyline', {id: "student-anno-" + JSXaal.Util.shapeCounter++});
		polyline.getPoints().each(function(item) {
			elem.appendChild(new Element('coordinate', {x: item[0], y: item[1]}));	
		});
		var style = new Element('style');
		style.appendChild(new Element('color', {name: this.color}));
		style.appendChild(new Element('stroke', {type: 'solid', width: '1'}));
		elem.appendChild(style);
		this.viewer.animator.addAnnotation(elem);
	}
});
JSXaal.UI.Toolbar.Zoom = Class.create({
	/**
	 * Constructor for the class.
	 * @function {public void} ?
	 * @param {Object} viewer Viewer object
	 */
	initialize: function(viewer) {
		this.viewer = viewer;
		this.zoom = 1.0;
		this.zoomFactor = 1.2;
	},
	/**
	 * A method that creates the necessary html elements for this toolbar component.
	 * @function {public Element} ?
	 * @return element
	 */
	create: function() {
		var elem = new Element("span");
		elem.appendChild(document.createTextNode(' Zoom:'))

		var zoomOut = new Element("a", {href: '#'});
		zoomOut.addClassName('zoom');
		zoomOut.addClassName('zoomOut');
		elem.appendChild(zoomOut);
		zoomOut.observe('click', function(evt) {
			evt.stop();
			this.zoom = this.zoom / this.zoomFactor;
			this.viewer.renderer.zoom(this.zoom, this.zoom);
		}.bind(this));

		var zoomIn = new Element("a", {href: '#'});
		zoomIn.addClassName('zoom');
		zoomIn.addClassName('zoomIn');
		elem.appendChild(zoomIn);
		zoomIn.observe('click', function(evt) {
			evt.stop();
			this.zoom = this.zoom * this.zoomFactor;
			this.viewer.renderer.zoom(this.zoom, this.zoom);
		}.bind(this));
		elem.appendChild(document.createTextNode(" "));
		return elem;
	}
});
JSXaal.UI.Toolbar.Language = Class.create({
	/**
	 * Constructor for the class.
	 * @function {public void} ?
	 * @param {Object} viewer Viewer object
	 */
	initialize: function(viewer, lang) {
		this.viewer = viewer;
		this.lang = lang;
		this.languages = [];
		this.languages.push(lang);
	},
	/**
	 * A method that creates the necessary html elements for this toolbar component.
	 * @function {public Element} ?
	 * @return element
	 */
	create: function() {
		var elem = new Element("span", {id: this.viewer.id + "-langtoolbar"});
		elem.update("Language: ");
		var sel = new Element("select");
		sel.observe('change', this.languageChanged.bind(this));
		
		this.languages.each(function(item, index) {
			var col = document.createElement("option");
			col.innerHTML = item;
			col.value = item;
			if (item.key == this.lang) {
				col.selected = "selected";
			}
			sel.appendChild(col);
		});
		this.sel = sel;
		elem.appendChild(this.sel);
		
		return elem;
	},
	/**
	 * Method called when value in the checkbox changes.
	 * @function {public void} ?
	 * @param evt The event
	 */
	languageChanged: function(evt) {
		var elem = evt.element();
		this.lang = elem.value;
		this.viewer.animator.refresh();
	},
	addLanguage: function(lang) {
		if (this.languages.indexOf(lang) == -1) {
			var col = document.createElement("option");
			col.innerHTML = lang;
			col.value = lang;
/*			if (item.key == this.lang) {
				col.selected = "selected";
			}*/
			this.sel.appendChild(col);
		}
	}
});/**
 * A class containing several utility functions for the Xaal viewer.
 * @class JSXaal.Util
 */
JSXaal.Util = new Object();
JSXaal.Util.colorNames = new Hash({ maroon: {r:128,g:0,b:0}, red:{r:255,g:0,b:0}, orange:{r:255,g:165,b:0}, yellow:{r:255,g:255,b:0},
 olive:{r:128,g:128,b:0}, purple:{r:128,g:0,b:128}, fuchsia:{r:255,g:0,b:255}, white:{r:255,g:255,b:255},
  lime:{r:0,g:255,b:0}, green:{r:0,g:128,b:0}, navy:{r:0,g:0,b:128}, blue:{r:0,g:0,b:255}, aqua:{r:0,g:255,b:255},
  teal:{r:0,g:128,b:128}, black:{r:0,g:0,b:0}, silver:{r:192,g:192,b:192}, gray:{r:128,g:128,b:128} });
/**
 * @function {public void} ?
 * @param {Object} colorName
 */
JSXaal.Util.convertColorName = function(colorName) {
	return this.colorNames.get(colorName);
};
/**
 * 
 */
JSXaal.Util.colorNameToString = function(colorName) {
	var col = JSXaal.Util.convertColorName(colorName);
	if (col) {
		return "rgb(" + col.r + "," + col.g + "," + col.b + ")";
	} else {
		return "rgb(0,0,0)";
	}
};
/**
 * @function {public void} ?
 * @param {Object} colorNode
 */
JSXaal.Util.convertColor = function(colorNode) {
	var name = colorNode.readAttribute("name");
	if (name) {
		return JSXaal.Util.convertColorName(name);
	}
	var red = colorNode.readAttribute("red") || 0;
	var green = colorNode.readAttribute("green") || 0;
	var blue = colorNode.readAttribute("blue") || 0;
	return {r:red, g:green, b:blue};
};
/**
 * @function {public void} ?
 * @param {Object} colorNode
 */
JSXaal.Util.colorToString = function(colorNode) {
	var col = JSXaal.Util.convertColor(colorNode);
	return "rgb(" + col.r + "," + col.g + "," + col.b + ")"; 	
};
/**
 * Converts the given color string into a javascript hash with r, g, and b entries.
 * The given string should be in format <code>rgb(255,255,255)</code>.
 * NOTE: this method does not return a Prototype Hash.
 * @function {public void} ?
 * @param {Object} colorString
 * @return {Hash}
 */
JSXaal.Util.colorstringToHash = function(colorString) {
	if (colorString.indexOf("rgb(") == 0) {
		colorString = colorString.substring(4, colorString.length -1);
		colorString = colorString.split(',');
		return {r: colorString[0], g: colorString[1], b: colorString[2]}; 
	}
}
/**
 * @function {public void} ?
 * @param {Object} node
 */
JSXaal.Util.getTextContents = function(nodes, lang) {
	lang = lang || 'en';
	var nodeIndex = 0;
	if (nodes.length > 1) {
		for (var i = 0; i < nodes.length; i++) {
			if (nodes[i].hasAttribute("lang") && nodes[i].readAttribute("lang") == lang) {
				nodeIndex = i;
				break; 
			}
		}
	}
	var children = nodes[nodeIndex].childNodes;
	var msg = "";
	var j = 0;
	for (;j<children.length;j++) {
		if (children[j].nodeType == 3) { // textnodes
			msg += children[j].nodeValue;
		}
	}
	return msg;
};
JSXaal.Util.shapeCounter = 0;
/**
 * @function {public void} ?
 * @param {Object} shape
 */
JSXaal.Util.generateID = function(shape, viewerId) {
	shape.setID("jsxaalautoshape" + JSXaal.Util.shapeCounter + viewerId);
	JSXaal.Util.shapeCounter++;
};
/**
 * Sets the ID of the given shape to be the id of the given xmlNode. If the
 * xmlNode has no id attribute, an ID will be generated for the shape.
 * @function {public void} ?
 * @param {Object} shape The shape that should have its ID set
 * @param {Object} xmlNode The xmlNode
 */
JSXaal.Util.setID = function(shape, xmlNode, viewerId) {
	var id = xmlNode.readAttribute("id");
	if (id) {
		shape.setID(id + viewerId);
	} else {
		JSXaal.Util.generateID(shape, viewerId);
	}
};
/**
 * @function {public void} ?
 * @param {Object} o
 */
JSXaal.Util.isShapeObject = function(o) {
	return (o instanceof Graphic.Rectangle || o instanceof Graphic.Circle ||
		o instanceof Graphic.Line || o instanceof Graphic.Polygon ||
		o instanceof Graphic.Polyline || o instanceof Graphic.Text);
};
JSXaal.Util.useShapeObject = function(viewer, shape, coordinate, scale) {
	// TODO: Clone the shape before use
	var newShape = JSXaal.Util.cloneShapeObject(viewer, shape);
	// TODO: store the clones in case the original shape is changed 
	newShape.translate(coordinate.x, coordinate.y);
	newShape.scale(scale, scale);
	viewer.renderer.add(newShape);
};
JSXaal.Util.cloneShapeObject = function(viewer, shape) {
	var newShape;
	if (shape instanceof Graphic.Polygon) {
		newShape = new Graphic.Polygon(viewer.renderer);
		newShape._setAttributes(Object.toJSON(shape.attributes).evalJSON());
        newShape.setPoints(shape.getPoints());
	} else if (shape instanceof Graphic.Circle) {
		newShape = new Graphic.Circle(viewer.renderer);
		newShape._setAttributes(Object.toJSON(shape.attributes).evalJSON());
	} else if (shape instanceof Graphic.Text) {
		newShape = new Graphic.Text(viewer.renderer);
		newShape._setAttributes(Object.toJSON(shape.attributes).evalJSON());
		//XXX: This is SVGRenderer-specific!
		newShape.setTextValue(shape.element.firstChild.nodeValue);
	}
	return newShape;
}
/**
 * @function {public void} ?
 * @param {Object} node
 */
JSXaal.Util.getContentsAsText = function(node) {
	var text = "";
	var children = node.childNodes;
	var j = 0;
	for (;j<children.length;j++) {
		if (children[j].nodeType == 3) { // textnodes
			text += children[j].nodeValue;
		} else if (children[j].nodeType == 1) {
			text += "<" + children[j].nodeName;
			var i = 0;
			for (;i<children[j].attributes.length; i++) {
				text += " " + children[j].attributes[i].nodeName + '="';
				text += children[j].attributes[i].nodeValue + '"'
			}
			text += ">";
			text += JSXaal.Util.getContentsAsText(children[j]);
			text += "</" + children[j].nodeName + ">";
		}
	}
	return text;
};
/**
 * Parses a given String to an XMLDocument.
 * @function {public XMLDocument} ?
 * @param {String} text
 */
JSXaal.Util.stringToXml =  function(text) { 
	try {
		var xmlDoc = new ActiveXObject('Microsoft.XMLDOM'); 
		xmlDoc.async = 'false'; 
		xmlDoc.loadXML(text); 
		return xmlDoc;
	} catch(e) {
		debug(e);
		try {
			return new DOMParser().parseFromString(text.strip(), 'text/xml'); 
		} catch(e) { debug(e);return null }
	}
};
/**
 * Returns a Prototype extended copy of the given element.
 * @function {public Element} ?
 * @param {Object} docRoot
 */
JSXaal.Util.recreateDocument = function(docRoot, viewer) {
	var newRoot = new Element(docRoot.nodeName);
	JSXaal.Util.copyChildElements(docRoot, newRoot, viewer);
	return newRoot;
};
/**
 * Copies attributes from the fromElem to the toElem.
 * @function {private void} ?
 * @param {Object} fromElem
 * @param {Object} toElem
 */
JSXaal.Util.copyAttributes = function(fromElem, toElem, viewer) {
	// TODO: In Opera: attribute named length overwrites the length property of the attributes
	//       array. How to handle this?
	for (var i=0;i<fromElem.attributes.length; i++) {
		var attr = fromElem.attributes[i];
		if (attr.nodeName == 'style') {
			toElem.setAttribute('x-style', attr.nodeValue);
		} else if (attr.nodeName == 'lang') {
			viewer.settings.addLanguage(attr.nodeValue);
		}
		toElem.setAttribute(attr.nodeName, attr.nodeValue);
	}
};
/**
 * Copies child elements from the fromElem to the toElem. Empty whitespace nodes
 * are ignored.
 * @function {private void} ?
 * @param {Object} fromElem
 * @param {Object} toElem
 */
JSXaal.Util.copyChildElements = function(fromElem, toElem, viewer) {
	JSXaal.Util.copyAttributes(fromElem, toElem, viewer);
	var children = fromElem.childNodes;
	var length = children.length;
	for (var i=0; i < length; i++) {
		var child = children[i];
		if (child.nodeType == 3 && !child.nodeValue.blank()) {
			toElem.appendChild(document.createTextNode(child.nodeValue));
		} else if (child.nodeType == 1) {
			var nodeName = child.nodeName;
			if (nodeName.toLowerCase() == 'style') {
				nodeName = 'x-' + nodeName;
			}
			var elem = new Element(nodeName);
			toElem.appendChild(elem);
			JSXaal.Util.copyChildElements(child, elem, viewer);
		}
	}
};
String.prototype.isXaalNode = function(nodeName) {
	return this.toLowerCase() == ("x-" + nodeName.toLowerCase());	
};var NODESIZE = 40;
/**
 * @class JSXaal.Structure
 */
JSXaal.Structure = Class.create({
	initialize: function(id) {
		this.id = id;
		this.style = null;
	},
	getId: function() {
		return this.id;
	},
	setId: function(id) {
		this.id = id;
	},
	draw: function(viewer) {
		debug("Unimplemented method of JSXaal.Structure");
	},
	setStyle: function(style) {
		this.style = style;
	},
	getStyle: function() {
		return this.style;
	},
	setName: function(name) {
		this.name = name;
	},
	getName: function() {
		if (!this.name) { return this.id; }
		return this.name;
	},
	setProperty: function(name, value) {
		if (name == 'name') {
			this.setName(value);
		} else {
			if (!this.properties) {
				this.properties = new Hash();
			}
			this.properties.set(name, value);
		}
	},
	getProperty: function(name) {
		if (!this.properties) {
			return null;
		} else {
			return this.properties.get(name);
		}
	},
	hasProperty: function(name) {
		if (this.getProperty(name)) {
			return true;
		} else {
			return false;
		}
	},
	setPosition: function(x, y) {
		this.position = {x: Number(x), y: Number(y)};
		if (isNaN(this.position.x)) { this.position.x = 0; }
		if (isNaN(this.position.y)) { this.position.y = 0; }
	},
	getPosition: function() {
		return this.position || {x:0, y:0};
	}
});
JSXaal.Node = Class.create(JSXaal.Structure, {
	initialize: function($super, id) {
		this.data = null;
	},
	setData: function(data) {
		if (data instanceof JSXaal.Key) {
			this.data = data;
		} else {
			var key = new JSXaal.Key();
			key.setParent(this);
			key.setData(data);
			this.data = key;
		}
	},
	getData: function() {
		return this.data;
	},
	getDataItem: function() {
		return this.data.getData();
	},
	setParent: function(parent) {
		this.parent = parent;
	},
	getParent: function() {
		return this.parent;
	}
});
JSXaal.Edge = Class.create(JSXaal.Structure, {
	initialize: function($super, from, to) {
		$super(null);
		this.from = from;
		this.to = to;
		this.directed = false;
	},
	setLabel: function(label) {
		this.label = label;
	}, 
	getLabel: function() {
		return this.label || '';
	},
	isDirected: function() {
		return this.directed;
	},
	setDirected: function(directed) {
		this.directed = directed;
	},
	getFrom: function() {
		return this.from;
	},
	getTo: function() {
		return this.to;
	}
});
JSXaal.Key = Class.create(JSXaal.Structure, {
	initialize: function($super) {
		$super(null);
		this.data = null;
		this.parent = null;
	},
	setData: function(data) {
		this.data = data;
	},
	getData: function() {
		return this.data;
	},
	setParent: function(parent) {
		this.parent = parent;
	},
	getParent: function() {
		return this.parent;
	}
});
/**
 * @class JSXaal.Tree 
 */
JSXaal.Tree = Class.create(JSXaal.Structure, {
	initialize: function($super, id) {
		$super(id);
		this.setName("Tree");
	},
	getRoot: function() {
		return this.root;
	},
	setRoot: function(node) {
		this.root = node;
	},
	draw: function(viewer) {
		var x = this.getPosition().x;
		var y = this.getPosition().y;
        this.getRoot().calculateLayout();
		this.getRoot().calculateFinalLayout(-NODESIZE/2, 10+JSXaalRenderer.NODEGAP);
		var group = new Graphic.Group(viewer.renderer);
		group.setID(this.id + viewer.id);
		var nodeGroup = new Graphic.Group(viewer.renderer);
		this.getRoot().draw(viewer, nodeGroup);
		var dsSize = nodeGroup.getSize();
		var width = dsSize.w + 2*JSXaalRenderer.NODEGAP;
		var height = dsSize.h + 2*JSXaalRenderer.NODEGAP;
		var isFrame = this.hasProperty("draw-frame")?this.getProperty("draw-frame")!='false':true;
		if (isFrame) {
			JSXaalRenderer.drawFrame(x, y, width, height, viewer.renderer, group, this.getName());
		}
		group.add(nodeGroup);
		var dx = JSXaalRenderer.NODEGAP - nodeGroup.getLocation().x;
		nodeGroup.translate(x + dx, y);
		viewer.renderer.add(group);
	}
});
/**
 * @class JSXaal.TreeNode 
 */
JSXaal.TreeNode = Class.create(JSXaal.Node, {
	initialize: function($super) {
		$super();
		this.children = new Array();
	},
	addChild: function(toNode) {
		this.children[this.children.size()] = toNode;
	},
	getChildren: function() {
		return this.children;
	},
	calculateFinalLayout: function(dx, dy) {
	        if (-this.contours.getLeftExtent() - this.getXTranslation() > 0) {
			this.translate(-this.contours.getLeftExtent() - this.getXTranslation(), 0);
		}
		this.translateNodes(dx, dy);
		this.propagateTranslations();
	},
	calculateLayout: function() {
		var ch = this.getChildren();
		for (var i = 0; i < ch.length; i++) {
			if (ch[i]) {
				ch[i].calculateLayout();
			} else {
				//debug("child is null!!");
			}
		}
		this.cachedTranslation = {width: 0, height: 0};
		this.translation = {width: 0, height: 0};
		this.calculateContours();
	},
	calculateContours: function() {
		var vtcSize = {width: NODESIZE, height: NODESIZE};
        var children = this.getChildren();
        var rootLeft = -vtcSize.width / 2;
		var rootRight = vtcSize.width / 2 + (vtcSize.width % 2 === 0 ? 0 : 1);
		var rootHeight = vtcSize.height;
		if (children.length === 0) {
			this.contours = new JSXaal.Tree.TreeContours(rootLeft, rootRight, rootHeight, this.getData().getData());
			this.translateThisNode(-rootLeft, 0);
		} else {
			var transSum = 0;
			var firstChild = children[0];
			this.contours = firstChild.contours;
			firstChild.contours = null;
			firstChild.translateNodes(0, JSXaalRenderer.NODEGAP + rootHeight);

			for (var i = 1; i < children.length; i++) {
				var child = children[i];
				var childC = child.contours;
				var trans = this.contours.calcTranslation(childC, JSXaalRenderer.NODEGAP);
				transSum += trans;

				child.contours = null;
				this.contours.joinWith(childC, trans);
	
				child.translateNodes(firstChild.getXTranslation() + trans - child.getXTranslation(),
                                	JSXaalRenderer.NODEGAP + rootHeight);
			}

			var rootTrans = transSum / children.length;
			this.contours.addOnTop(rootLeft, rootRight, rootHeight, JSXaalRenderer.NODEGAP, rootTrans);
			this.translateThisNode(firstChild.getXTranslation() + rootTrans, 0);
		}
	},
	translateThisNode: function(x, y) {
		this.translation.width += x;
		this.translation.height += y;
	},
	translateAllNodes: function(howMuch) {
		if (!this.cachedTranslation) {
			this.cachedTranslation = {width: 0, height: 0};
		}
		this.cachedTranslation.width += howMuch.width;
		this.cachedTranslation.height += howMuch.height;
	},
	translateNodes: function(x, y) {
		this.translateAllNodes({width: x, height: y});
	},
	getXTranslation: function() {
		return this.translation.width +
			((!this.cachedTranslation) ? 0 : this.cachedTranslation.width);
	},
	propagateTranslations: function() {
		if (this.cachedTranslation) {
			var ch = this.getChildren();
			for (var i = 0; i < ch.size(); i++) {
				var child = ch[i];
				child.translateAllNodes(this.cachedTranslation);
				child.propagateTranslations();
			}
			this.translation.width += this.cachedTranslation.width;
			this.translation.height += this.cachedTranslation.height;
			this.cachedTranslation = null;
		}
	},
	draw: function(viewer, group) {
		if (!this.getPosition() || (this.getPosition().x === 0 && this.getPosition().y === 0)) {
			this.setPosition(this.translation.width, this.translation.height);
		}
		JSXaalRenderer.renderNode(viewer.renderer, this, group);
		for (var index = 0, len = this.getChildren().length; index < len; ++index) {
			var item = this.getChildren()[index];
			if (!(item instanceof JSXaal.TreeNode.DUMMYNODE)) {
				item.draw(viewer, group);
				JSXaalRenderer.renderEdge(this, item, new JSXaal.Edge(), group);
			}
		}
	}
});
/**
 * @class JSXaal.BinTree 
 */
JSXaal.BinTree = Class.create(JSXaal.Tree, {
	initialize: function($super, id) {
		$super(id);
		this.setName("Binary Tree");
	}
});
/**
 * @class JSXaal.BinTreeNode 
 */
JSXaal.BinTreeNode = Class.create(JSXaal.TreeNode, {
	initialize: function($super) {
		$super();
		this.children[0] = null;//new JSXaal.TreeNode.DUMMYNODE();
		this.children[1] = null;//new JSXaal.TreeNode.DUMMYNODE();
	},
	setLeft: function(node) {
		this.children[0] = node;
		if (!this.children[1]) { this.setRight(new JSXaal.TreeNode.DUMMYNODE()); }
	},
	setRight: function(node) {
		this.children[1] = node;
		if (!this.children[0]) { this.setLeft(new JSXaal.TreeNode.DUMMYNODE()); }
	},
	getLeft: function() {
		return this.children[0];
	},
	getRight: function() {
		return this.children[1];
	},
    getChildren: function() {
        var myChildren = new Array();
        if (this.getLeft() || this.getRight()) {
            myChildren.push(this.getLeft());
            myChildren.push(this.getRight());
        }
        return myChildren;
    }
});
JSXaal.TreeNode.DUMMYNODE = Class.create(JSXaal.TreeNode, {
	initialize: function($super) {
		$super();
		var dummyKey = new JSXaal.Key();
		dummyKey.setData('');
		this.setData(dummyKey);
	},
	getName: function() { 
		return "DUMMY";
	},
	getLeft: function() {
		return null;
	},
	getRight: function() {
		return null;
	},
	getChildren: function() {
		return new Array();
	}
});
/**
 * @class JSXaal.BinSearchTree 
 */
JSXaal.BinSearchTree = Class.create(JSXaal.BinTree, {
	initialize: function($super, id) {
		$super(id);
		this.setName("Bin Search Tree");
	},
	insert: function(value) {
		var node = this.newNode();
		node.setData(value);
	  	if (!this.getRoot()) {
			this.setRoot(node);
		} else {
  			this.getRoot().insert(node);
  		}
	},
	newNode: function(value) {
		return new JSXaal.BinSearchTreeNode();
	}
});
JSXaal.BinSearchTreeNode = Class.create(JSXaal.BinTreeNode, {
	initialize: function($super){
		$super();
	},
	insert: function(node) {
		if (node.getData() <= this.getData()) {
			if (this.getLeft()) {
				return this.getLeft().insert(node);
			} else {
  				this.setLeft(node);
  			}
		} else {
			if (this.getRight()) {
				return this.getRight().insert(node);
			} else {
				this.setRight(node);
  			}  		
  		}
  	}
});
JSXaal.Tree.TreeContours = Class.create({
	initialize: function(left, right, height, data) {
		this.cHeight = height;
		this.leftCDims = [];
		this.leftCDims[this.leftCDims.size()] = {width: -left, height: height};
		this.cLeftExtent = left;
		this.rightCDims = [];
		this.rightCDims[this.rightCDims.size()] = {width: -right, height: height};
		this.cRightExtent = right;
	},
	getHeight: function() {
		return this.cHeight;
	},
	getLeftExtent: function() {
		return this.cLeftExtent;
	},
	getRightExtent: function() {
		return this.cRightExtent;
	},
	getWidth: function() {
		return this.cRightExtent - this.cLeftExtent;
	},
	addOnTop: function(left, right, height, addHeight, originTrans) {
		this.leftCDims[this.leftCDims.size()-1].height += addHeight;
		this.leftCDims[this.leftCDims.size()-1].width += originTrans + left;
		this.rightCDims[this.rightCDims.size()-1].height += addHeight;
		this.rightCDims[this.rightCDims.size()-1].width += originTrans + right;

		this.leftCDims[this.leftCDims.size()] = {width: -left, height: height};
		this.rightCDims[this.rightCDims.size()] = {width: -right, height: height};
		this.cHeight += height + addHeight;
		this.cLeftExtent -= originTrans;
		this.cRightExtent -= originTrans;
		if (left < this.cLeftExtent) {
			this.cLeftExtent = left;
		}
		if (right > this.cRightExtent) {
			this.cRightExtent = right;
		}
	},
	joinWith: function(other, hDist) {
		if (other.cHeight > this.cHeight) {
			var newLeftC = new Array();
			var otherLeft = other.cHeight - this.cHeight;
			var thisCDisp = 0;
			var otherCDisp = 0;
			other.leftCDims.each(function (item) {
				if (otherLeft > 0 ) {
					var dim = {width: item.width, height: item.height};
					otherLeft -= item.height;
					if (otherLeft < 0) {
						dim.height += otherLeft;					
					}
					newLeftC[newLeftC.size()] = dim;
				} else {
					otherCDisp += item.width;
				}
			});
			var middle = newLeftC[newLeftC.size() - 1];

			this.leftCDims.each(function(item) {
				thisCDisp += item.width;
				newLeftC[newLeftC.size()] = {width: item.width, height: item.height};
			});
               
			middle.width -= thisCDisp - otherCDisp;
			middle.width -= hDist;
			this.leftCDims = newLeftC;
		}
		if (other.cHeight >= this.cHeight) {
			this.rightCDims = other.rightCDims.clone();
		} else {
			var thisLeft = this.cHeight - other.cHeight;
			var nextIndex = 0;

			var thisCDisp = 0;
			var otherCDisp = 0;
			this.rightCDims.each(function (item) {
				if (thisLeft > 0 ) {
					nextIndex++;
					thisLeft -= item.height;
					if (thisLeft < 0) {
						item.height += thisLeft;
					}
				} else {
					thisCDisp += item.width;
				}
			});
			for (var i = nextIndex+1;i< this.rightCDims.size();i++) {
				this.rightCDims[i] = null;
			}
			this.rightCDims = this.rightCDims.compact();
			var middle = this.rightCDims[nextIndex];

			for (i = 0; i < other.rightCDims.size(); i++) {
				var item = other.rightCDims[i];
				otherCDisp += item.width;
				this.rightCDims[this.rightCDims.size()] = {width: item.width, height: item.height};
			}
			middle.width += thisCDisp - otherCDisp;
			middle.width += hDist;
		}
		this.rightCDims[this.rightCDims.size()-1].width -= hDist;

		if (other.cHeight > this.cHeight) {
			this.cHeight = other.cHeight;
		}
		if (other.cLeftExtent + hDist < this.cLeftExtent) {
			this.cLeftExtent = other.cLeftExtent + hDist;
		}
		if (other.cRightExtent + hDist > this.cRightExtent) {
			this.cRightExtent = other.cRightExtent + hDist;
		}
	},
	calcTranslation: function(other, wantedDist) {
		var lc = this.rightCDims;
		var rc = other.leftCDims;
		var li = lc.size() - 1;
		var ri = rc.size() - 1;
        	var lCumD = {width: 0, height: 0};
		var rCumD = {width: 0, height: 0};
		var displacement = wantedDist;

		while (true) {
			if (li < 0) {
				if (ri < 0 || rCumD.height >= lCumD.height) {
					break;
				}
				var rd = rc[ri];
				rCumD.height += rd.height;
				rCumD.width += rd.width;
				ri--;
			} else if (ri < 0) {
				if (lCumD.height >= rCumD.height) {
					break;
				}
				var ld = lc[li];
				lCumD.height += ld.height;
				lCumD.width += ld.width;
				li--;
			} else {
				var ld = lc[li];
				var rd = rc[ri];
				var leftNewHeight = lCumD.height;
				var rightNewHeight = rCumD.height;
				if (leftNewHeight <= rightNewHeight) {
					lCumD.height += ld.height;
					lCumD.width += ld.width;
					li--;
				}
				if (rightNewHeight <= leftNewHeight) {
					rCumD.height += rd.height;
					rCumD.width += rd.width;
					ri--;
				}
			}
			if (displacement < rCumD.width - lCumD.width + wantedDist) {
				displacement = rCumD.width - lCumD.width + wantedDist;
			}
		}
		return displacement;
	}
});
/**
 * @class JSXaal.List 
 */
JSXaal.List = Class.create(JSXaal.Structure, {
	initialize: function($super, id) {
		$super(id);
		this.setName("LinkedList");
		this.head = null;
	},
	getHead: function() {
		return this.head;
	},
	setHead: function(listnode) {
		this.head = listnode;
	},
	draw: function(viewer) {
		// TODO: orientation of lists
		var group = new Graphic.Group(viewer.renderer);
		group.setID(this.getId() + viewer.id);
		var x = this.getPosition().x;
		var y = this.getPosition().y;
		var charWidth = 9;
		var textLength = 4;
		var width = charWidth*textLength+50*this.size()+60;
		var height = 75;
		JSXaalRenderer.drawFrame(x, y, width, height, viewer.renderer, group, this.getName());
		var curr = this.getHead();
		var left = -15;
		var prev;
		while (curr) {
			var itemLength = curr.getData().getData().length;
			var padding = 0;
			var nodeWidth = charWidth*itemLength + 10;
			if (nodeWidth < NODESIZE) {
				padding = (NODESIZE - nodeWidth)/2;
				nodeWidth = NODESIZE;
			}
			left += 30;
			curr.setPosition(x+left, y+25);
			JSXaalRenderer.renderNode(viewer.renderer, curr, group);
			left += nodeWidth;
			if (prev) {
				var edge = new JSXaal.Edge(prev, curr);
				edge.setStyle(prev.getNextStyle());
				edge.setDirected(true);
				JSXaalRenderer.renderEdge(prev, curr, edge, group);
			}
			prev = curr;
			curr = curr.getNext();
		}
		viewer.renderer.add(group);
	},
	size: function() {
		if (!this.getHead()) { return 0;}
		else {
			var count = 1;
			var curr = this.getHead();
			while (curr.hasNext()) {
				curr = curr.getNext();
				count++;
			}
			return count;
		}
	}
});
JSXaal.ListNode = Class.create(JSXaal.Node, {
	initialize: function($super) {
		$super();
	},
	setNext: function(value, style) {
		if (value instanceof JSXaal.ListNode) {
			this.next = value;
		} else {
			var node = new JSXaal.ListNode();
			node.setData(value);
			this.next = node;
		}
		this.nextStyle = style;
	},
	getNext: function() {
		return this.next;
	},
	hasNext: function() {
		return Boolean(this.next);
	},
	getNextStyle: function() {
		return this.nextStyle;
	}
});
/**
 * @class JSXaal.Array
 */
JSXaal.Array = Class.create(JSXaal.Structure, {
	/**
	 * @function {public void} ?
	 * @param {Object} $super A marker for Prototype to store the superclass constructor.
	 * 	This parameter is not part of the parameters you pass to the function. See <a href="http://prototypejs.org/api/class/create">http://prototypejs.org/api/class/create</a>.
	 * @param {Object} id
	 * 
	 */
	initialize: function($super, id) {
		$super(id);
		this.array = new Array();
		this.indexed = true;
		this.setName("Array");
	},
	setData: function(index, data) {
		if (!this.array[index]) {
			this.array[index] = new JSXaal.ArrayIndex();
		}
		this.array[index].setData(data);
	},
	getData: function(index) {
		if (!this.array[index]) {
			return "";
		}
		return this.array[index].getDataItem();
	},
	setIndexText: function(index, text) {
		this.array[index].setIndexText(text);
	},
	getIndexText: function(index) {
		if (!this.array[index]) { return String(index); }
		return this.array[index].getIndexText() || String(index);
	},
	setIndexed: function(value) {
		this.indexed = value;
	},
	isIndexed: function() {
		return (this.indexed == true);
	},
	getIndex: function(index) {
		return this.array[index];
	},
	setIndex: function(index, indexObj) {
		if (!indexObj || !(indexObj instanceof JSXaal.ArrayIndex)) {
			return;
		} else {
			this.array[index] = indexObj;
		}
	},
	setIndexStyle: function(index, style) {
		this.array[index].setStyle(style);
	},
	getIndexStyle: function(index) {
		return this.array[index].getStyle() || this.getStyle();
	},
	getSize: function() {
		return this.array.size();
	},
	/**
	 * This function draws this array using the renderer of the given viewer.
	 * @function {public void} ?
	 * @param {Object} viewer
	 * @see JSXaalViewer
	 */
	draw: function(viewer) {
		var textLength = 0;
		for (var index = 0; index < this.array.length; ++index) {
  			var item = this.getData(index);
			textLength += item.length;
  		}
		var group = new Graphic.Group(viewer.renderer);
		group.setID(this.getId() + viewer.id);
		var x = this.getPosition().x;
		var y = this.getPosition().y;
		var charWidth = 9;
		var width = charWidth*textLength+10*this.array.size()+60;
		var height = 100;
		if (!this.isIndexed()) {
			height -= NODESIZE/2.0;
		}
		var isFrame = this.hasProperty("draw-frame")?this.getProperty("draw-frame")!='false':true;
		if (isFrame) {
			JSXaalRenderer.drawFrame(x, y, width, height, viewer.renderer, group, this.getName());
		}
		var lengthCount = 0;
		for (var index = 0; index < this.array.length; ++index) {
			var indexGroup = group;
  			var item = this.getData(index);
			if (this.getIndex(index).getId()) {
				indexGroup = new Graphic.Group(viewer.renderer);
				indexGroup.setID(this.getIndex(index).getId() + viewer.id);
				group.add(indexGroup);
			}
			var itemLength = item.length;
			var text = new Graphic.Text(viewer.renderer);
			text.setLocation(x+index*10+charWidth*lengthCount+35, y + (isFrame?50:25));
			text.setTextValue(item);
			JSXaalRenderer.setKeyStyle(text, this.getIndex(index).getData().getStyle());
/*			text.setFill({r: 0, g: 0, b: 0, a: 0});
			text.setStroke({r: 0, g: 0, b: 0, a: 0});*/
			
			var left = x+30+index*10+charWidth*lengthCount;
			var indRect = new Graphic.Rectangle(viewer.renderer);
			indRect.setBounds(left, y+(isFrame?25:0), 10 + charWidth*itemLength, NODESIZE);
			JSXaalRenderer.setNodeStyle(indRect, this.getIndexStyle(index));
			indexGroup.add(indRect);
			indexGroup.add(text);
			// next draw the indices
			if (this.isIndexed()) {
				text = new Graphic.Text(viewer.renderer);
				var lengthDiff = itemLength - this.getIndexText(index).length;
				var t = lengthDiff;
				text.setLocation(x+index*10+charWidth*lengthCount+35 + 10*lengthDiff/2, y + 80);
				text.setTextValue(this.getIndexText(index));
				text.setFill({r: 0, g: 0, b: 0, a: 0});
				text.setStroke({r: 0, g: 0, b: 0, a: 0});
				indexGroup.add(text);
			}
			lengthCount += itemLength;
  		}

		viewer.renderer.add(group);
	}
});
JSXaal.ArrayIndex = Class.create(JSXaal.Node, {
	initialize: function($super) {
		$super();
	},
	setIndexText: function(text) {
		this.label = text;
	},
	getIndexText: function() {
		return this.label;
	}
});
JSXaal.Graph = Class.create(JSXaal.Structure, {
	initialize: function($super, id) {
		$super(id);
		this.setName("Graph");
		this.nodes = new Hash();
	},
	addNode: function(node) {
		this.nodes.set(node.getId(), node);
	},
	removeNode: function(node) {
		if (this.nodes.get(node.getId())) {
			this.nodes.unset(node.getId());
		}
	},
	getNode: function(nodeId) {
		return this.nodes.get(nodeId);
	},
	addEdge: function(srcNode, targetNode, edge) {
		// TODO styling of edges
		this.nodes.get(srcNode.getId()).addSuccessor(targetNode, edge);
	},
	setCoordinateData: function(viewer, data) {
		$H(data['coordinates']).each(function(coord) {
			var node = this.getNode(coord.key);
			if (node) { 
				node.setPosition(parseInt(coord.value.x), parseInt(coord.value.y)); 
			}
		}.bind(this));
		this.draw(viewer);
	},
	_hasNodePositions: function() {
		var pos = true;
		this.nodes.each(function(node) {
			//if (id == 'graph5') {debug((node.value.getPosition().x===0)+","+(Number(node.value.getPosition().y)===0));}
			if (node.value.getPosition().x === 0 && node.value.getPosition().y === 0) {
				pos = false;
				return;
			}
		});
		return pos;
	},
	draw: function(viewer) {
		/*if (!this._hasNodePositions()) {
			JSXaalRenderer.util.getGraphLayout(viewer, this);
			return;
		}*/
		var x = this.getPosition().x;
		var y = this.getPosition().y;
		var group = new Graphic.Group(viewer.renderer);
		group.setID(this.id + viewer.id);
		var nodeGroup = new Graphic.Group(viewer.renderer);
		var maxX = 0, maxY = 0;
		this.nodes.each(function(pair) {
			JSXaalRenderer.renderNode(viewer.renderer, pair.value, nodeGroup);
			pair.value.successors.each(function(value) {
				JSXaalRenderer.renderEdge(pair.value, value.node, value.edge, nodeGroup);
				maxX = Math.max(maxX, value.node.getPosition().x);	
				maxY = Math.max(maxY, value.node.getPosition().y);	
			});		
		});
		nodeGroup.translate(x + 10, y + 20);
		JSXaalRenderer.drawFrame(x, y, maxX + 20 + NODESIZE, maxY + 30 + NODESIZE, viewer.renderer, group, this.getName());
		group.add(nodeGroup);
		if (viewer.settings.isSmoothAnimation()) {
			//group.setOpacity(0.01);
			viewer.renderer.add(group);
			//viewer.animator.addEffect(group.getID(), "XaalOpacity", "{from:0.01, to:255}");
		} else {
			viewer.renderer.add(group);			
		}
	}
});
JSXaal.GraphNode = Class.create(JSXaal.Node, {
	initialize: function($super) {
		$super();
		this.successors = [];
	},
	addSuccessor: function(node, edge) {
		this.successors.push({node: node, edge: edge});
	},
	getSuccessors: function() {
		return this.successors;
	}
});
