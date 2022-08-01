package org.openrefine.extensions.sparql.model;

import java.util.ArrayList;
import java.util.List;

public class JsonColumn {

    private List<String> columnNames;

    public JsonColumn(List<String> columns) {
        super();
        this.columnNames = columns;
    }

    public List<String> getColumnNames() {
        return columnNames;
    }

    public void setColumnNames(ArrayList<String> columnNames) {
        this.columnNames = columnNames;
    }

    @Override
    public String toString() {
        return String.join(", ", columnNames);
    }

}
