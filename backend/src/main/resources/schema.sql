CREATE TABLE IF NOT EXISTS scenarios (
                                         id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    params_json CLOB NOT NULL,
    result_json CLOB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255)
    );

CREATE TABLE IF NOT EXISTS graph_nodes (
                                           id VARCHAR(36) PRIMARY KEY,
    indicator VARCHAR(255) NOT NULL,
    unit VARCHAR(50),
    current_value DOUBLE,
    is_derived BOOLEAN DEFAULT FALSE,
    position_x DOUBLE,
    position_y DOUBLE,
    user_id VARCHAR(255),
    kind VARCHAR(20) DEFAULT 'indicator'
    );

CREATE TABLE IF NOT EXISTS graph_edges (
                                           id VARCHAR(36) PRIMARY KEY,
    source_id VARCHAR(36) NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    operator VARCHAR(1) NOT NULL,
    user_id VARCHAR(255)
    );