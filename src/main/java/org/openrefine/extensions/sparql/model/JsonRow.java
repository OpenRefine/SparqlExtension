package org.openrefine.extensions.sparql.model;

import java.util.List;

public class JsonRow {

    private int index;

    private List<String> values;

    public int getIndex() {
        return index;
    }

    public void setIndex(int index) {
        this.index = index;
    }

    public List<String> getValues() {
        return values;
    }

    public void setValues(List<String> values) {
        this.values = values;
    }

}
