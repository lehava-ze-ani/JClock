function showError(error) 
{
    var x;
    switch(error.code) 
    {
        case error.PERMISSION_DENIED:
            x = "הפעל מיקום."
        break;
        case error.POSITION_UNAVAILABLE:
            x = "התחבר לרשת והפעל מיקום."
            break;
        case error.TIMEOUT:
            x = "הבקשה לקבל מיקום לא נענתה."
            break;
        case error.UNKNOWN_ERROR:
            x = "שגיאת מיקום לא ידועה."
            break;
    }
    alert(x);
	
	window.location.href = "./index.html?latitude=31.656466&longitude=35.228143";
}
