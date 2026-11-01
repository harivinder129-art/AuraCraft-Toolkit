
    try {
        new Function(WScript.Arguments(0));
        WScript.Echo('Syntax OK');
    } catch(e) {
        WScript.Echo(e.message);
    }
    