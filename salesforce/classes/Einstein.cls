public class Einstein {

    @AuraEnabled
    public static Object query() {
        return [SELECT Product__c, Product__r.Name, Sales_Order__c 
                FROM Sales_Order_Line__c 
                WHERE Product__c != null AND Product__r.Name != null AND Product__r.Name != ''
                ORDER BY Sales_Order__c];     
    }     
    
    @AuraEnabled
    public static String getToken() {
        String token = '';
        List<Einstein__c> el = [SELECT Token__c FROM Einstein__c WHERE Name='token' LIMIT 1];
        if (el.size() == 1) {
            token = el[0].Token__c;    
        }
        return token;
    }     

    @AuraEnabled
    public static void setToken(String token) {
        Einstein__c e = new Einstein__c(Name='token', Token__c=token);
		upsert e Name;
    }             
    
}