import React from 'react';
import './index.css';
import * as serviceWorker from './serviceWorker';
import 'bootstrap/dist/css/bootstrap.min.css';
import {Badge, Card, Container, Row, Col, Navbar, Nav, Form, Button} from 'react-bootstrap';
import ff from './ff.js';
import ReactMarkdown from 'react-markdown';
import { Graph } from 'react-d3-graph';


let router = new ff.Router()

// helpers

let linkReference = function (reference) {
    // XXX: workaround mishandling of [foobar] in ReactMarkdown
    // https://github.com/rexxars/react-markdown/issues/115#issuecomment-357953459
    if (!reference.href) {
        return `[ ${reference.children[0].props.value} ]`;
    }

    return <a href={reference.$ref}>{reference.children}</a>
}

// graph

// the graph configuration, you only need to pass down properties
// that you want to override, otherwise default ones will be used
let myConfig = {
    nodeHighlightBehavior: true,
    node: {
        color: 'lightgreen',
        size: 120,
        highlightStrokeColor: 'blue'
    },
    link: {
        highlightColor: 'lightblue'
    },
    height: 768,
    width: 1024
};

let onClickGraphNode = async function(app, model, event) {

    let schema = model.schema;
    let xpath = `//*[@name="${event}"]`;

    let result = schema.evaluate(xpath, schema, null, XPathResult.ANY_TYPE, null);

    let element = result.iterateNext();

    model = {schema:schema, element: element};

    return () => model;
};

let graphInit = async function(app, model, param) {
    let response = await ff.get("/schema.xml");
    let text = await response.text()
    let parser = new DOMParser();
    let schema = parser.parseFromString(text, "application/xml");

    let newModel = {schema: schema, element: undefined};

    return () => newModel;
}

let graphView = function(model, mc) {
    let schema = model.schema;
    let element = model.element;
    let data = {nodes: [], links: []};

    let table;
    let result = schema.evaluate( '//table', schema, null, XPathResult.ANY_TYPE, null);
    while(table = result.iterateNext()) {
        let columns = table.querySelectorAll(':scope > column');
        table = table.getAttribute("name");
        data.nodes.push({id: table, symbolType: "diamond", size: 150, color: "red"});

        for (let column of columns) {
            column = column.getAttribute("name");
            data.nodes.push({id: column});
            data.links.push({source: table, target: column});
        }
    }

    let hit;
    if (element !== undefined) {
        hit = <Hit element={element} mc={mc} />;
    } else {
        hit = <p>Select a node</p>;
    }

    return (
        <>
            <Header />
            <Container fluid>
                <Row>
                    <Col>
                        <Graph id="graph-id"
                               data={data}
                               config={myConfig}
                               onClickNode={mc(onClickGraphNode)}
                        />
                    </Col>
                    <Col>
                        { hit }
                    </Col>
                </Row>
            </Container>
        </>

    );
};

router.append('/graph/', graphInit, graphView)

// home

let homeInit = async function() {
    let response = await ff.get("/schema.xml");
    let text = await response.text()
    let parser = new DOMParser();
    let schema = parser.parseFromString(text, "application/xml");

    let newModel = {schema: schema, query: "", hits: []};

    return () => newModel;
}


let match = function(element, query) {
    let remarks = element.getAttribute('remarks');
    let name = element.getAttribute('name');
    return remarks.includes(query) || name.includes(query);
}

let onSubmit = async function(app, model, event) {
    event.preventDefault();
    let schema = model.schema;
    let query = model.query;
    let element;
    let elements = [];

    let result = schema.evaluate( '//table', schema, null, XPathResult.ANY_TYPE, null);
    while(element = result.iterateNext()) {
        elements.push(element);
    }

    result = schema.evaluate( '//table/column', schema, null, XPathResult.ANY_TYPE, null);
    while(element = result.iterateNext()) {
        elements.push(element);
    }

    let hits = elements.filter(element => match(element, query));

    model.hits = hits;

    return () => model;
}

let onQueryChange = async function(app, model, event) {
    model.query = event.target.value;
    return () => model;
}

let Hit = function({element, mc}) {
    let badge;
    if(element.tagName === "table") {
        badge = <Badge variant="primary">Table</Badge>;
    } else if (element.tagName === "column") {
        badge = <Badge variant="secondary">Column</Badge>;
    }

    let name = element.getAttribute('name');

    return (
        <div>{badge} <ff.Link mc={mc} href={"/reference/#" + name}>{name}</ff.Link> <small className="text-muted">{element.getAttribute("remarks")}</small></div>
    )
}

let homeView = function(model, mc) {
    let query = model.query;
    let hits = model.hits.map(element => <Hit key={element.getAttribute("name")} element={element} mc={mc} />);

    return (
        <>
            <Header/>
            <Container>
                <Row>
                    <Col>
                        <Form onSubmit={mc(onSubmit)}>
                            <Form.Group>
                                <Form.Label>Recherche</Form.Label>
                                <Form.Control type="text"
                                              placeholder="filtre"
                                              value={query}
                                              onChange={mc(onQueryChange)}
                                />
                                <Form.Text className="text-muted">
                                    Filtrer les tables ou colonnes.
                                </Form.Text>
                            </Form.Group>

                            <Button variant="primary" type="submit">
                                Submit
                            </Button>
                        </Form>
                    </Col>
                </Row>
                {hits}
            </Container>
        </>
    );
}

router.append('/', homeInit, homeView)

// reference

let referenceInit = async function() {
    let response = await ff.get("/schema.xml");
    let text = await response.text()
    let parser = new DOMParser();
    let schema = parser.parseFromString(text, "application/xml");

    let newModel = {schema: schema};

    return (app, model) => newModel;
}

let Header = function() {
    return (
        <Navbar bg="light" expand="lg">
            <Navbar.Brand href="/">omop-schema-viz</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
                <Nav className="mr-auto">
                    <Nav.Link href="/">Home</Nav.Link>
                    <Nav.Link href="/reference/">Reference</Nav.Link>
                    <Nav.Link href="/graph/">Graph</Nav.Link>
                </Nav>
            </Navbar.Collapse>
        </Navbar>
    )
}


let maybePkIndex = function(pk, name) {
    for (let element of pk) {
        if (element.getAttribute('column') === name) {
            return element.getAttribute('sequenceNumberInPK');
        }
    }
    return false;
}


let Column = function({column, pk}) {
    let name = column.getAttribute('name');
    let remarks = column.getAttribute('remarks');
    let maybeIndex = maybePkIndex(pk, name);

    if (maybeIndex) {
        pk = <Badge variant="info" title="sequence number in primary key">{ maybeIndex }</Badge>
    } else {
        pk = "";
    }

    return (
        <div>
            <h3 id={name}><Badge variant="secondary">Column</Badge> {pk} {name}</h3>
            <ReactMarkdown  renderers={{ linkReference: linkReference }}
                            source={remarks} />
        </div>
    );
}


let IndexColumn = function({column}) {
    let name = column.getAttribute('name');
    let ascending;

    if (column.getAttribute('ascending') === "true") {
        ascending = <Badge variant="success">ascending</Badge>;
    } else {
        ascending = <Badge variant="danger">descending</Badge>;
    }

    return <li>{name} {ascending}</li>
}


let Index = function({index}) {
    let name = index.getAttribute('name');
    let unique;
    if (index.getAttribute('unique') === "true") {
        unique = <Badge variant="warning">unique</Badge>;
    } else {
        unique = "";
    }

    let columns = Array.prototype.slice.call(index.querySelectorAll(':scope > column'));

    return (
        <Card>
            <Card.Body>
                <div>
                    <h4><Badge variant="success">Index</Badge> {unique} {name}</h4>
                    <ul>
                        {columns.map(column => <IndexColumn key={column.getAttribute("name")}
                                                            column={column} />)}
                    </ul>
                </div>
            </Card.Body>
        </Card>
    );
}




let Table = function({table}) {
    let name = table.getAttribute('name');
    let remarks = table.getAttribute('remarks');
    let columns = Array.prototype.slice.call(table.querySelectorAll(':scope > column'));
    let indices = Array.prototype.slice.call(table.querySelectorAll(':scope > index'));
    let pk = Array.prototype.slice.call(table.querySelectorAll(':scope > primaryKey'));

    return (
        <Container fluid="md">
            <Row>
                <Col>
                    <Card>
                        <Card.Body>
                            <h2 id={name}><Badge variant="primary">Table</Badge> {name}</h2>
                            <ReactMarkdown renderers={{ linkReference: linkReference }}
                                           source={remarks} />
                            {columns.map(column => <Column key={column.getAttribute("name")}
                                                           column={column} pk={pk} />)}
                            {indices.map(index => <Index key={index.getAttribute("name")} index={index} />)}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    )
}


let referenceView = function(model, mc) {
    let schema = model.schema;
    let result = schema.evaluate( '//table', schema, null, XPathResult.ANY_TYPE, null);
    let tables = [];
    let table;

    while(table = result.iterateNext()) {
        tables.push(table);
    }

    return (
        <>
            <Header/>
            {tables.map(table => <Table key={table.getAttribute('name')}
                                        table={table}></Table>)}
        </>
    )
}

router.append('/reference/', referenceInit, referenceView)

ff.createApp(router);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
