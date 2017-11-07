<aura:application useAppcache="false" access="global" extends="force:slds">
    <aura:handler value="{!this}" name="init" action="{!c.init}"/>
    <c:train />
</aura:application>