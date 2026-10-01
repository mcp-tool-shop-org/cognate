<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.md">English</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center"><strong>स्वायत्त बुद्धिमत्ता के लिए संरचनात्मक शासन।</strong></p>

कॉग्नेट, [एटटेस्टिया](https://github.com/mcp-tool-shop-org/attestia) पर निर्मित एआई शासन परत है। एटटेस्टिया यह साबित करता है कि कुछ हुआ — कोई घटना, कोई लेनदेन, कोई स्थिति परिवर्तन — और उस प्रमाण को एक श्रृंखला से जोड़ता है। कॉग्नेट उन समान एटटेस्टेशन प्रिमिटिव का उपयोग एआई सिस्टम को नियंत्रित करने के लिए करता है: एक मॉडल को क्या करने की अनुमति दी गई थी, उसने वास्तव में क्या किया, और किसने इसे अधिकृत किया।

समान मूल, एआई की सच्चाई की पुष्टि करता है: मॉडल की उत्पत्ति, नीतिगत निर्णय, एजेंट की क्षमताएं, और संकेत और आउटपुट की अखंडता। समान मर्कल प्रमाण। समान केवल-जोड़ घटना भंडार। अलग डोमेन।

एटटेस्टिया उन बुनियादी तत्वों पर वित्तीय डोमेन को लागू करता है। रेपोमेश एक स्वतंत्र आरएफसी 6962 लेज़र पर जारी करने का नेटवर्क है। यह पैकेज एक प्रमाण के लिए एटटेस्टिया और `@cognate/repomesh-bridge` के माध्यम से रेपोमेश को कॉल करता है, जब किसी रिलीज़ की जांच करने की आवश्यकता होती है।

## स्थापित करें

```bash
npm install @mcptoolshop/cognate
```

नोड 22 या उसके बाद का संस्करण। लाइब्रेरी इस पैकेज में हैं, जिसमें रेपोमेश रिलीज़ जांच भी शामिल है। आंतरिक `@cognate/*` नाम प्रकाशित नहीं किए जाते हैं।

```ts
import { policy } from "@mcptoolshop/cognate";
import { evaluatePolicy } from "@mcptoolshop/cognate/policy";

const result = evaluatePolicy(policyDocument, context);
if (result.overall === "deny") {
  // do not call the model
}
```

| आयात करें | यह क्या है |
|--------|------------|
| `@mcptoolshop/cognate` | नेमस्पेस: `types`, `policy`, `modelRegistry`, `agentIdentity`, `promptStore` |
| `@mcptoolshop/cognate/policy` | `evaluatePolicy` |
| `@mcptoolshop/cognate/model-registry` | मॉडल संस्करण और तैनाती से पहले अनुमोदन द्वार |
| `@mcptoolshop/cognate/agent-identity` | क्षमता अनुदान, अनुमोदन, निरसन |
| `@mcptoolshop/cognate/prompt-store` | केवल-जोड़ने योग्य एन्क्रिप्टेड प्रॉम्प्ट और आउटपुट लॉग |
| `@mcptoolshop/cognate/types` | साझा संज्ञाएं |

ये शुद्ध फ़ंक्शन हैं। आप घड़ी, किरायेदार कुंजी और स्टोर पास करते हैं। यह पैकेज सॉकेट नहीं खोलता है।

हैंडबुक: <https://mcp-tool-shop-org.github.io/cognate/handbook/>
