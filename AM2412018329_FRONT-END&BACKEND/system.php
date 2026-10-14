<?php

    if ($path === 'system/status' && $method === 'GET') {
        requireApiKey($path);

        respond(200, [
            'success' => true,
            'message' => 'NovaTix service status retrieved successfully.',
            'service' => 'NovaTix API',
            'database' => 'connected'
        ], $path);
    }

    if ($path === 'system/status') {
        respond(405, [
            'success' => false,
            'message' => 'This HTTP method is not available for this endpoint.'
        ], $path);
    }

    if ($path === 'health' && $method === 'GET') {
        respond(200, [
            'success' => true,
            'message' => 'NovaTix API is running.',
            'database' => 'connected'
        ], $path);
    }
