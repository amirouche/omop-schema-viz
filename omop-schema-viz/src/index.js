import React from 'react';
import './index.css';
import * as serviceWorker from './serviceWorker';
import 'bootstrap/dist/css/bootstrap.min.css';
import {Badge, Card, Container, Row, Col, Navbar, Nav, Form, Button} from 'react-bootstrap';
import ff from './ff.js';
import ReactMarkdown from 'react-markdown';


let router = new ff.Router()

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
    return remarks.includes(query);
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

let Hit = function({element}) {
    let badge;
    if(element.tagName === "table") {
        badge = <Badge variant="primary">Table</Badge>;
    } else if (element.tagName === "column") {
        badge = <Badge variant="secondary">Column</Badge>;
    }

    let name = element.getAttribute('name');

    return (
        <div>{badge} <a href={"/reference/#" + name}>{name}</a> <small className="text-muted">{element.getAttribute("remarks")}</small></div>
    )
}

let homeView = function(model, mc) {
    let query = model.query;
    let hits = model.hits.map(element => <Hit element={element}/>);

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
            <ReactMarkdown source={remarks} />
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
                            <ReactMarkdown source={remarks} />
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

    ff.pk('tables', tables);


    return (
        <>
            <Header/>
            {tables.map(table => <Table key={table.getAttribute('name')}
                                        table={table}></Table>)}
        </>
    )
}

router.append('/', homeInit, homeView)
router.append('/reference/', referenceInit, referenceView)

ff.createApp(router);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
