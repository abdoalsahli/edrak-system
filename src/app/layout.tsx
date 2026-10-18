import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "نظام إدراك - مركز التأهيل والاستشارات",
  description: "نظام إدارة مركز التأهيل والاستشارات",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar-u-nu-latn" dir="rtl">
      <body>
        {children}
        {/* Convert Eastern Arabic numerals (٠-٩ and ۰-۹) to Western (0-9) globally */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  var map={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
           '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
  var re=/[٠-٩۰-۹]/g;
  function cvt(node){
    if(node.nodeType===3){
      // Never rewrite script/style text — including this script's own source,
      // which would make the DOM differ from the server HTML (hydration warning)
      var p=node.parentNode;
      if(p && (p.nodeName==='SCRIPT' || p.nodeName==='STYLE')) return;
      var t=node.textContent;
      if(re.test(t)){node.textContent=t.replace(re,function(d){return map[d];});}
      re.lastIndex=0;
    } else if(node.nodeType===1 && node.tagName!=='SCRIPT' && node.tagName!=='STYLE'){
      for(var i=0;i<node.childNodes.length;i++) cvt(node.childNodes[i]);
    }
  }
  function run(){cvt(document.body);}
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run);}
  else{run();}
  new MutationObserver(function(ms){
    ms.forEach(function(m){
      m.addedNodes.forEach(function(n){cvt(n);});
      if(m.type==='characterData') cvt(m.target);
    });
  }).observe(document.body,{childList:true,subtree:true,characterData:true});
})();
        `}} />
      </body>
    </html>
  );
}
