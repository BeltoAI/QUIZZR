import JSZip from 'jszip';
import type { Quiz } from '@/lib/types';

function xmlEscape(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function buildAssessmentXml(quiz: Quiz): string {
  const items = quiz.questions.map((q, idx) => {
    const labels = q.choices.map(c =>
      `      <response_label ident="${c.id}"><material><mattext texttype="text/plain">${xmlEscape(c.text)}</mattext></material></response_label>`
    ).join('\n');
    const correct = q.correctChoiceId;
    const feedback = xmlEscape(q.explanation ?? '');
    return `    <item ident="ITEM-${idx+1}" title="${xmlEscape(q.prompt.slice(0, 96))}">
      <presentation>
        <material><mattext texttype="text/plain">${xmlEscape(q.prompt)}</mattext></material>
        <response_lid ident="response1" rcardinality="Single">
          <render_choice>
${labels}
          </render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="1" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        <respcondition continue="No">
          <conditionvar><varequal respident="response1">${correct}</varequal></conditionvar>
          <setvar action="Set" varname="SCORE">1</setvar>
          <displayfeedback feedbacktype="Response" linkrefid="correct"/>
        </respcondition>
      </resprocessing>
      <itemfeedback ident="correct"><material><mattext texttype="text/plain">${feedback}</mattext></material></itemfeedback>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <assessment ident="A1" title="${xmlEscape(quiz.title)}">
    <section ident="root_section">
${items}
    </section>
  </assessment>
</questestinterop>`;
}

function buildManifest(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-QUIZZR" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_rootv1p1p2.xsd">
  <organizations />
  <resources>
    <resource identifier="RES1" type="imsqti_test_xmlv1p2" href="assessment_qti.xml">
      <file href="assessment_qti.xml" />
    </resource>
  </resources>
</manifest>`;
}

export async function quizToQtiZip(quiz: Quiz): Promise<Blob> {
  const zip = new JSZip();
  zip.file('assessment_qti.xml', buildAssessmentXml(quiz));
  zip.file('imsmanifest.xml', buildManifest());
  return await zip.generateAsync({ type: 'blob' });
}
