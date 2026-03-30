#set page(
  margin: (top: 2cm, bottom: 2cm, left: 2.5cm, right: 2cm)
)

#let subject_name = "{{ subject_name }}"
#let subject_code = "{{ subject_code }}"
#let project_title = "{{ project_title }}"
#let student_department = "{{ student_department }}"
#let academic_year = "{{ academic_year }}"
#let student_name_1 = "{{ student_name_1 }}"
#let student_name_2 = "{{ student_name_2 }}"
#let student_name_3 = "{{ student_name_3 }}"
#let student_id_1 = "{{ student_id_1 }}"
#let student_id_2 = "{{ student_id_2 }}"
#let student_id_3 = "{{ student_id_3 }}"
#let guide_name = "{{ guide_name }}"
#let guide_designation = "{{ guide_designation }}"
#let guide_department = "{{ guide_department }}"
#let hod_name = "{{ hod_name }}"
#let hod_designation = "{{ hod_designation }}"
#let hod_department = "{{ hod_department }}"
#let principal_name = "{{ principal_name }}"
#let principal_designation_1 = "{{ principal_designation_1 }}"
#let principal_designation_2 = "{{ principal_designation_2 }}"
#let semester = "{{ semester }}"
#let abstract_content = "{{ abstract_content }}"
#let vtu_logo_path = "vtu-logo.jpeg"
#let clg_logo_path = "clg_logo.jpeg"
#let clg_name_path = "clg_name.jpeg"

// First page border (fixed 1.5cm inset from page edges)
#set page(
  foreground: place(
    top + left,
    dx: 1.5cm,
    dy: 1.5cm,
    rect(
      width: 100% - 3cm,
      height: 100% - 3cm,
      fill: none,
      stroke: 2pt + black,
    ),
  ),
)

#align(center)[

#set text(font: "Times New Roman", size: 16pt)
#strong[VISVESVARAYA TECHNOLOGICAL UNIVERSITY] \
#set text(font: "Times New Roman", size: 14pt)
#stack(spacing: 5pt,
  [JNANASANGAMA, BELAGAVI - 590018],
  [#image(vtu_logo_path, width: 2.5cm, height: 2.5cm)],
)

#set text(font: "Times New Roman", size: 12pt)

#strong[#subject_name Project Report \ (#subject_code) \ On \ #project_title] \ \
_Submitted in partial fulfillment for the award of the degree of_ \ \
#strong[Bachelor of Engineering]\
in\
#strong[#student_department] \

Submitted by \
#strong[#student_name_1 (#student_id_1)  \
#student_name_2 (#student_id_2)#if(student_name_3 != "") [  \
#student_name_3 (#student_id_3)]]
#v(0.5cm)

#strong[Internal Guide]\
#strong[#guide_name]  \
#guide_designation,\
#guide_department  \
BNMIT, Bengaluru
#image(clg_logo_path, width: 3cm)
#image(clg_name_path, width: 15cm)

#set text(font: "Times New Roman", size: 11pt)
*An Autonomous Institution under VTU*\
Approved by AICTE, Accredited as a grade A Institution by NAAC. All eligible branches – CSE, ECE, \
EEE, ISE & Mech. Engg. are Accredited by NBA for academic years 2025-26 to 2027-28.\
URL: www.bnmit.org

#set text(font: "Times New Roman", size: 14pt)
#strong[#student_department] \
#underline([#academic_year])
]
#pagebreak()

#align(center)[
#image(clg_name_path, width: 15cm)

#set text(font: "Times New Roman", size: 11pt)
*An Autonomous Institution under VTU*\
Approved by AICTE, Accredited as a grade A Institution by NAAC. All eligible branches – CSE, ECE, \
EEE, ISE & Mech. Engg. are Accredited by NBA for academic years 2025-26 to 2027-28.\
URL: www.bnmit.org

#set text(font: "Times New Roman", size: 14pt)
#strong[Department of #student_department] 

#image(clg_logo_path, width: 3cm)
]
#set text(font: "Times New Roman", size: 16pt)
#align(center)[
#underline[#strong[CERTIFICATE]]
]

#set text(font: "Times New Roman", size: 12pt)
#set par(justify: true, leading: 1em)

#let certified_text = [Certified that the #subject_name project entitled #strong[#project_title] carried out by #if(student_name_3 != "") [#student_name_1 (#student_id_1), #student_name_2 (#student_id_2) and #student_name_3 (#student_id_3)] else [#if(student_name_2 != "") [#student_name_1 (#student_id_1) and #student_name_2 (#student_id_2)] else [#student_name_1 (#student_id_1)]] are Bonafide students of #semester Semester, BNM Institute of Technology in partial fulfillment for the award of Bachelor of Engineering in #student_department, of Visvesvaraya Technological University, Belagavi during the year #academic_year. It is certified that all corrections/suggestions indicated for Internal Assessment have been incorporated in the report deposited in the departmental library.  The #subject_name project report (#subject_code) has been approved as it satisfies the academic requirements in respect of Project work prescribed for the said Degree.]

#certified_text

#strong(
  [
    #v(2cm)
  #grid(
    columns: 3,
    gutter: 2.5cm,
    [
    #guide_name \ 
    #guide_designation \ 
    #guide_department  \
    BNMIT, Bengaluru
    ],
    [
    #hod_name  \
    #hod_designation  \
    #hod_department  \
    BNMIT, Bengaluru
    ],
    [
    #principal_name  \
    #principal_designation_1  \
    #principal_designation_2  \
    BNMIT, Bengaluru
    ]
  ) \

  #table(
    columns: (1fr, 1fr, 1fr),
    stroke: none,
    inset: 5pt,
    align: (left, left, left),
    [], [Name], [Signature with Date],
    [Examiner 1:], [], [],
    [], [], [],
    [], [], [],
    [Examiner 2:], [], [],
  )
  ]
)
#pagebreak()\
#set text(font: "Times New Roman", size: 16pt)
#align(center)[
#strong[ACKNOWLEDGEMENT]
] 

#set text(font: "Times New Roman", size: 12pt)
#set par(justify: true, leading: 1.5em)
We would like to place on record, our sincere thanks and gratitude to the concerned people, whose suggestions and words of encouragement have been valuable. 
#v(0.5cm)
We express our heartfelt gratitude to the management of *BNM Institute of Technology*, for allowing us to pursue a Degree in Computer Science and Engineering and helping us to shape our career. We take this opportunity to thank *Shri. Narayan Rao R. Maanay*, Secretary, *Prof. T. J. Rama Murthy*, Director, *Dr. S. Y. Kulkarni*, Additional Director and Principal, *Prof. Eishwar N Maanay*, Dean and *Dr. Krishnamurthy G.N.* Deputy Director, for their support and encouragement to pursue this project. We would like to thank *#hod_name*, #hod_designation, for her support and encouragement. 
#v(0.5cm)
We would like to thank our guide #guide_name, #guide_designation, for his/her support and encouragement.
#v(0.5cm)
Finally, we are thankful to all the teaching and non-teaching staff of the Department of Computer Science and Engineering for their help in the successful completion of our project. Last but not least we would like to extend our sincere gratitude to our parents and all our friends who are a constant source of inspiration.

#align(right)[
  #block(width: 10cm)[
    *#student_name_1* *(#student_id_1)* \
    *#student_name_2* *(#student_id_2)*#if(student_name_3 != "") [  \
    *#student_name_3* *(#student_id_3)*]
  ]
 ]

 #pagebreak()\
#set text(font: "Times New Roman", size: 16pt)
#align(center)[
#strong[ABSTRACT]
] 
#v(0.5cm)
#set text(font: "Times New Roman", size: 12pt)
#abstract_content
