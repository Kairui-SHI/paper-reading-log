---
title: "ContactGen: Generative Contact Modeling for Grasp Generation"
date: 2026-10-04
authors: Shaowei Liu, Yang Zhou, Jimei Yang, Saurabh Gupta, Shenlong Wang
paper_url: https://arxiv.org/abs/2310.03740
code_url: https://github.com/stevenlsw/contactgen
tags:
  - 3D Vision
  - Grasp Generation
  - Contact Modeling
status: 准备阅读
summary: 以物体为中心表示手与物体的接触关系，再通过条件生成模型和基于模型的优化生成多样且几何可行的抓取姿态。
---

## 阅读入口

- [arXiv 页面](https://arxiv.org/abs/2310.03740)
- [CVF 论文 PDF](https://openaccess.thecvf.com/content/ICCV2023/papers/Liu_ContactGen_Generative_Contact_Modeling_for_Grasp_Generation_ICCV_2023_paper.pdf)
- [项目主页](https://stevenlsw.github.io/contactgen/)
- [官方代码](https://github.com/stevenlsw/contactgen)

我用文字写了你再跟我梳理格式吧。
词语积累: concise, comprehensive,  contact representation for hand-object interaction
underlying 潜在的 (观测背后真正决定它的东西)
comprises three components
predict diverse and geometrically feasible grasps
gained substantial importance across various domains
HOI for animation, games, and augmented and virtual reality
**address the aforementioned challenges [句中连词]**

行文方法：

abstract：
1. This paper present a novel [method] for [领域？目标？] 我认为目标比较合适，什么方法，为了什么。方法是创新，用在什么领域一句话点明。
2. [method] 核心亮点
3. pipelien 实现路径
4. 实验 demonstrate ...
四句话解决。

Introduction:

一: (modeling 这个真的很重要 for 领域A 对应abs第一句话)
1. modeling 这个为什么重要 [high-level]
2. For instance, 给个例子大家理解
3. 为了实现这个重要的事情，需要一个什么 [紧扣本文提出的核心亮点]
4. 展开具体讲一下上面那个[核心亮点]是什么，因为只有一个词，需要一些例子和一些拆开的通俗解释告诉大家怎么做。 e.g. precise contact prediction [核心亮点] -> 解释: contact probability map [precise] of hand contact region to the object surface [contact], e.g. which parts of the hand will touch the object
或者: A thorough contact modeling should account for factors such as (举例子展开)

二: (大家也modeling，但是他们的method不好、他们的representation方式不好)
1. Previous approaches often rely on [what 短板], which [解释这个短板是什么，数学上、理论上、通俗的解释]。
2. **但是**！ [短板] 为什么是短板。
3. **Specifically**, 解释一下短板为什么是短板这句话，上一句话是给出的结论，可能有一些含糊的词例如 [lacks details/ lacks ability ...] 这里要具体解释为什么有了短板，还有这些问题。
4. **Moreover**, 再加一句加强一下

三: (引出自己核心观点: 我们的好)
1. In this paper, we address the aforementioned challenges [句中连词] ...

四: (模型其他细节，支撑完成整个故事)


