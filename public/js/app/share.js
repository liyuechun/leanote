//------------------------------------
// 共享, notbeook, note
//------------------------------------

// 默认共享notebook id
Share.defaultNotebookId = "share0";
Share.defaultNotebookTitle = "Default Share";
Share.sharedUserInfos = {}; // userId => {}

// 在render时就创建, 以后复用之
Share.userNavs = {}; // userId => {"forList":html, "forNew":html}

// 缓存都不要, 统一放在Note.cache中
// 放在这里, 只是为了debug, 分离
Share.notebookCache = {}; // notebooks 的cache
Share.cache = {}; // note的cache

// 分享的弹出框是note的
Share.dialogIsNote = true;

// 设置缓存 note
Share.setCache = function(note) {
	if(!note || !note.NoteId) {
		return;
	}
	Share.cache[note.NoteId] = note;
}

/**
 * 我的共享notebooks	    
 <div id="shareNotebooks">
	 <div class="folderNote closed">
      <div class="folderHeader">
        <a>
          <h1>
            <i class="fa fa-angle-right"></i> 
            Life's</h1>
        </a>
      </div>
      <ul class="folderBody">
        <li><a>Hadoop</a></li>
        <li><a>Node webkit</a></li>
        <li><a>Hadoop</a></li>
        <li><a>Node webkit</a></li>
      </ul>
    </div>
 */
// TODO 层级
// shareNotebooks = {userId => {}}
Share.getNotebooksForNew = function(userId, notebooks) {
	var self = this;
	var navForNewNote = "";
	
	var len = notebooks.length;
	for(var i = 0; i < len; ++i) {
		var notebook = notebooks[i];
		notebook.IsShared = true;
		notebook.UserId = userId;
		self.notebookCache[notebook.NotebookId] = notebook;
		// notebook的cache也缓存一份, 为了显示标题
		Notebook.cache[notebook.NotebookId] = notebook;
		
		var classes = "";
		var subs = false;
		if(!isEmpty(notebook.Subs)) {
			log(11);
			log(notebook.Subs);
			var subs = self.getNotebooksForNew(userId, notebook.Subs);
			if(subs) {
				classes = "dropdown-submenu";
			}
		}
		
		var eachForNew = "";
		if(notebook.Perm) {
			var eachForNew = t('<li role="presentation" class="clearfix ?" userId="?" notebookId="?"><div class="new-note-left pull-left" title="为该笔记本新建笔记" href="#">?</div><div title="为该笔记本新建markdown笔记" class="new-note-right pull-left">M</div>', classes, userId, notebook.NotebookId, notebook.Title);
			if(subs) {
				eachForNew  += "<ul class='dropdown-menu'>";
				eachForNew  += subs;
				eachForNew  += "</ul>";
			}
			eachForNew  += '</li>';
		}
		
		navForNewNote += eachForNew;
	}
	return navForNewNote;
}
Share.trees = {};
Share.renderShareNotebooks = function(sharedUserInfos, shareNotebooks) {
	var self = Share;
	if(isEmpty(sharedUserInfos)) {
		return;
	}
	
	if(!shareNotebooks || typeof shareNotebooks != "object" || shareNotebooks.length < 0) {
		return;
	}
	
	var $shareNotebooks = $("#shareNotebooks");

	// render每一个用户的share给我的笔记本, 之前先建一个默认共享
	for(var i in sharedUserInfos) {
		var userInfo = sharedUserInfos[i];
		var userNotebooksPre = shareNotebooks[userInfo.UserId] || [];
		
		userNotebooks = [{NotebookId: self.defaultNotebookId, Title: Share.defaultNotebookTitle}].concat(userNotebooksPre)
		
		self.notebookCache[self.defaultNotebookId] = userNotebooks[0];

		var username = userInfo.Username || userInfo.Email;
		userInfo.Username = username;
		Share.sharedUserInfos[userInfo.UserId] = userInfo;
		var userId = userInfo.UserId;
		var header = t('<li class="each-user"><div class="friend-header" fromUserId="?"><i class="fa fa-angle-down"></i><span>?</span> <span class="fa notebook-setting" title="setting"></span> </div>', userInfo.UserId, username);
		var friendId = "friendContainer_" + userId;
		var body = '<ul class="friend-notebooks ztree" id="' + friendId + '" fromUserId="' + userId + '"></ul>';
		$shareNotebooks.append(header + body + "</li>")
		
		self.trees[userId] = $.fn.zTree.init($("#" + friendId), Notebook.getTreeSetting(true, true), userNotebooks);
	
		self.userNavs[userId] = {"forNew": self.getNotebooksForNew(userId, userNotebooksPre)};
		log(self.userNavs);
	}
	
	$(".friend-notebooks").hover(function () {
		if (!$(this).hasClass("showIcon")) {
			$(this).addClass("showIcon");
		}
	}, function() {
		$(this).removeClass("showIcon");
	});
	
	$(".friend-header i").click(function() {
		var $this = $(this);
		var $tree = $(this).parent().next();
		if($tree.is(":hidden")) {
			$tree.slideDown("fast");
			$this.removeClass("fa-angle-right fa-angle-down").addClass("fa-angle-down");
		} else {
			$tree.slideUp("fast");
			$this.removeClass("fa-angle-right fa-angle-down").addClass("fa-angle-right");
		}
	});
	
	//-----------------------------
	// contextmenu shareNotebooks
	// 删除共享笔记本
	var shareNotebookMenu = {
			width: 150, 
			items: [
				{ text: "删除共享笔记本", icon: "", faIcon: "fa-trash-o", action: Share.deleteShareNotebook }
			], 
			onShow: applyrule,
			onContextMenu: beforeContextMenu,
			
			parent: "#shareNotebooks",
			children: ".notebook-item",
	};
	function applyrule(menu) {
		return;
	}
	// 默认共享不能删除
	function beforeContextMenu() {
		var notebookId = $(this).attr("notebookId");
		return !Share.isDefaultNotebookId(notebookId);
	}
	
	var menuNotebooks = $("#shareNotebooks").contextmenu(shareNotebookMenu);
	
	//---------------------------
	// contextmenu shareNotebooks
	// 删除某用户所有的
	var shareUserMenu = {
			width: 150, 
			items: [
				{ text: "删除所有共享", icon: "", faIcon: "fa-trash-o", action: Share.deleteUserShareNoteAndNotebook }
			],
			parent: "#shareNotebooks",
			children: ".friend-header",
	};
	
	var menuUser = $("#shareNotebooks").contextmenu(shareUserMenu);
	
	$(".friend-header").on("click", ".notebook-setting", function(e) {
		e.preventDefault();
		e.stopPropagation();
		var $p = $(this).parent();
		menuUser.showMenu(e, $p);
	});
	$("#shareNotebooks .notebook-item").on("click", ".notebook-setting", function(e) {
		e.preventDefault();
		e.stopPropagation();
		var $p = $(this).parent();
		menuNotebooks.showMenu(e, $p);
	});
};

Share.isDefaultNotebookId = function(notebookId) {
	return Share.defaultNotebookId == notebookId;
}

// 转成共享的nav
// for list和for new
// 如果forNew没有, 那么还是保持我的nav
Share.toggleToSharedNav = function(userId, notebookId) {
	var self = this;
	// for list
	$("#curNotebookForListNote").html(Share.notebookCache[notebookId].Title + '(' + Share.sharedUserInfos[userId].Username + ")");
	
	// for new
	// 如果该用户下有新建的note, 那么列出, 如果没有, 则列出我的笔记
	var forNew = Share.userNavs[userId].forNew;
	if(forNew) {
		$("#notebookNavForNewSharedNote").html(forNew);
		// 新建之, 可能当前选择的没有权限新建. 此时需要得到第一个
		var curNotebookId = "";
		var curNotebookTitle = "";
		if(Share.notebookCache[notebookId].Perm) {
			curNotebookId = notebookId;
			curNotebookTitle = Share.notebookCache[notebookId].Title;
		} else {
			// 得到第一个
			var $f = $("#notebookNavForNewSharedNote li").eq(0);
			curNotebookId = $f.attr("notebookId");
			curNotebookTitle = $f.find(".new-note-left").text();
		}
		
		$("#curNotebookForNewSharedNote").html(curNotebookTitle + '(' + Share.sharedUserInfos[userId].Username + ')');
		$("#curNotebookForNewSharedNote").attr("notebookId", curNotebookId);
		$("#curNotebookForNewSharedNote").attr("userId", userId);
		
		$("#newSharedNote").show();
		$("#newMyNote").hide();
		
	} else {
		// 展示出我的笔记
		$("#newMyNote").show();
		$("#newSharedNote").hide();
	}
	
	// 隐藏tag
	$("#tagSearch").hide();
}

//改变笔记本
//0. 改变样式
//1. 改变note, 此时需要先保存
//2. ajax得到该notebook下的所有note
//3. 使用Note.RederNotes()
Share.changeNotebook = function(userId, notebookId) {
	// 选中
	Notebook.selectNotebook($(t('#friendContainer_? a[notebookId="?"]', userId, notebookId)));
	
	// 改变nav!!!! TODO
	Share.toggleToSharedNav(userId, notebookId);
	
	// 1
	Note.curChangedSaveIt();
	
	// 2 先清空所有
	Note.clearAll();
	
	var url = "/share/ListShareNotes/";
	var param = {userId: userId};
	if(!Share.isDefaultNotebookId(notebookId)) {
		param.notebookId = notebookId;
	}
	
	// 2 得到笔记本
	// 这里可以缓存起来, note按notebookId缓存
	ajaxGet(url, param, function(ret) {
		// note 导航
		// 
		// 如果是特定笔记本下的notes, 那么传过来的没有权限信息, 此时权限由notebookId决定
		if(param.notebookId) {
			
		}
		Note.renderNotes(ret, false, true);
		// 渲染第一个
		// 这里, 有点小复杂, 还要判断权限...
		if(!isEmpty(ret)) {
			// 定位
			Note.changeNote(ret[0].NoteId, true);
		} else {
		}
	});
}

// 是否有更新权限
// called by Note
Share.hasUpdatePerm = function(notebookId) {
	var note = Share.cache[notebookId];
	if(!note || !note.Perm) {
		return false;
	}
	return true;
}

//---------------------------
// 我删除别人共享给我的笔记本
Share.deleteShareNotebook = function(target) {
	if(confirm("Are you sure to delete it?")) {
		var notebookId = $(target).attr("notebookId");
		var fromUserId = $(target).closest(".friend-notebooks").attr("fromUserId"); // 谁共享给了我 from
		ajaxGet("/share/DeleteShareNotebookBySharedUser", {notebookId: notebookId, fromUserId: fromUserId}, function(ret) {
			if(ret) {
				$(target).parent().remove();
			}
		});
	}
}
Share.deleteShareNote = function(target) {
	var noteId = $(target).attr("noteId");
	var fromUserId = $(target).attr("fromUserId"); // 谁共享给了我 from
	ajaxGet("/share/DeleteShareNoteBySharedUser", {noteId: noteId, fromUserId: fromUserId}, function(ret) {
		if(ret) {
			$(target).remove();
		}
	});
}
Share.deleteUserShareNoteAndNotebook = function(target) {
	if(confirm("Are you sure to delete all shared notebooks and notes?")) {
		var fromUserId = $(target).attr("fromUserId"); // 谁共享给了我 from
		ajaxGet("/share/deleteUserShareNoteAndNotebook", {fromUserId: fromUserId}, function(ret) {
			if(ret) {
				$(target).parent().remove();
			}
		});
	}
}

// 新建shared note
Share.changeNotebookForNewNote = function(notebookId) {
	// 改变nav for list, for new
	Notebook.selectNotebook($(t('#shareNotebooks [notebookId="?"]', notebookId)));
	var userId = Share.notebookCache[notebookId].UserId;
	Share.toggleToSharedNav(userId, notebookId);	
	
	// 得到笔记本
	var url = "/share/ListShareNotes/";
	var param = {userId: userId, notebookId: notebookId};
		
	// 2 得到笔记本
	// 这里可以缓存起来, note按notebookId缓存
	ajaxGet(url, param, function(ret) {
		// note 导航
		Note.renderNotes(ret, true, true);
	});
}

// 删除笔记, 我有权限, 且是我创建的笔记
Share.deleteSharedNote = function(target, contextmenuItem) {
	Note.deleteNote(target, contextmenuItem, true);
}
Share.copySharedNote = function(target, contextmenuItem) {
	Note.copyNote(target, contextmenuItem, true);
}

Share.contextmenu = null;
Share.initContextmenu = function(notebooksCopy) {
	if(Share.contextmenu) {
		Share.contextmenu.destroy();
	}
	
	//---------------------
	// context menu
	//---------------------
	var noteListMenu = {
		width: 170, 
		items: [
			{ text: "复制到我的笔记本", alias: "copy", icon: "",
				type: "group", 
				width: 150, 
				items: notebooksCopy
			},
			{ type: "splitLine" },
			{ text: "删除", alias: "delete", icon: "", faIcon: "fa-trash-o", action: Share.deleteSharedNote }
		], 
		onShow: applyrule,
		parent: "#noteItemList",
		children: ".item-shared",
	}
	function applyrule(menu) {
		var noteId = $(this).attr("noteId");
		var note = Share.cache[noteId];
		if(!note) {
			return;
		}
		var items = [];
		if(!(note.Perm && note.CreatedUserId == UserInfo.UserId)) {
			items.push("delete");
		}
		// 不是自己的创建的不能删除
        menu.applyrule({
        	name: "target...",
            disable: true,
            items: items
        });		
	   
	}
	
	Share.contextmenu = $("#noteItemList .item-shared").contextmenu(noteListMenu);
}

$(function() {
	// note setting
	$("#noteItemList").on("click", ".item-shared .item-setting", function(e) {
		e.preventDefault();
		e.stopPropagation();
		// 得到ID
		var $p = $(this).parent();
		Share.contextmenu.showMenu(e, $p);
	});
	
	
	
	//---------------------------
	// 新建笔记
	// 1. 直接点击新建 OR
	// 2. 点击nav for new note
	$("#newSharedNoteBtn").click(function() {
		var notebookId = $("#curNotebookForNewSharedNote").attr('notebookId');
		var userId = $("#curNotebookForNewSharedNote").attr('userId');
		Note.newNote(notebookId, true, userId);
	});
	$("#newShareNoteMarkdownBtn").click(function() {
		var notebookId = $("#curNotebookForNewSharedNote").attr('notebookId');
		var userId = $("#curNotebookForNewSharedNote").attr('userId');
		Note.newNote(notebookId, true, userId, true);
	});
	$("#notebookNavForNewSharedNote").on("click", "li div", function() {
		var notebookId = $(this).parent().attr("notebookId");
		var userId = $(this).parent().attr("userId");
		
		if($(this).text() == "M") {
			Note.newNote(notebookId, true, userId, true);
		} else {
			Note.newNote(notebookId, true, userId);
		}
	});
	
	//------------------
	// 添加共享
	$("#leanoteDialogRemote").on("click", ".change-perm", function() {
		var self = this;
		var perm = $(this).attr("perm");
		var noteOrNotebookId = $(this).attr("noteOrNotebookId");
		var toUserId = $(this).attr("toUserId");
		var toHtml = "可编辑";
		var toPerm = "1";
		if(perm == "1") {
			toHtml = "只读";
			toPerm = "0";
		}
		var url = "/share/UpdateShareNotebookPerm";
		var param = {perm: toPerm, toUserId: toUserId};
		if(Share.dialogIsNote) {
			url = "/share/UpdateShareNotePerm";
			param.noteId = noteOrNotebookId;
		} else {
			param.notebookId = noteOrNotebookId;
		}
		ajaxGet(url, param, function(ret) {
			if(ret) {
				$(self).html(toHtml);
				$(self).attr("perm", toPerm);
			}
		});
	});
	
	$("#leanoteDialogRemote").on("click", ".delete-share", function() {
		var self = this;
		var noteOrNotebookId = $(this).attr("noteOrNotebookId");
		var toUserId = $(this).attr("toUserId");
		
		var url = "/share/DeleteShareNotebook";
		var param = {toUserId: toUserId};
		if(Share.dialogIsNote) {
			url = "/share/DeleteShareNote";
			param.noteId = noteOrNotebookId;
		} else {
			param.notebookId = noteOrNotebookId;
		}	
		
		ajaxGet(url, param, function(ret) {
			if(ret) {
				$(self).parent().parent().remove();
			}
		});
	});
	
	// 添加共享
	var seq = 1;
	$("#leanoteDialogRemote").on("click", "#addShareNotebookBtn", function() {
		seq++;
		var tpl = '<tr id="tr' + seq + '"><td>#</td><td><input id="friendsEmail" type="text" class="form-control" style="width: 200px" placeholder="好友邮箱"/></td>';
		tpl += '<td><label for="readPerm' + seq + '"><input type="radio" name="perm' + seq + '" checked="checked" value="0" id="readPerm' + seq + '"> 只读</label>';
		tpl += ' <label for="writePerm' + seq + '"><input type="radio" name="perm' + seq + '" value="1" id="writePerm' + seq + '"> 可编辑</label></td>';
		tpl += '<td><button class="btn btn-success" onclick="addShareNoteOrNotebook(' + seq + ')">分享</button>';
		tpl += ' <button class="btn btn-warning" onclick="deleteShareNoteOrNotebook(' + seq + ')">删除</button>';
		tpl += "</td></tr>";
		$("#shareNotebookTable tbody").prepend(tpl);
		
		$("#tr" + seq + " #friendsEmail").focus();
	});
	
	//-------------------
	// 发送邀请邮件
	$("#registerEmailBtn").click(function() {
		var content = $("#emailContent").val();
		var toEmail = $("#toEmail").val();
		if(!content) {
			showAlert("#registerEmailMsg", "邮件内容不能为空", "danger");
			return;
		}
		post("/user/sendRegisterEmail", {content: content, toEmail: toEmail}, function(ret) {
			showAlert("#registerEmailMsg", "发送成功!", "success");
			hideDialog2("#sendRegisterEmailDialog", 1000);
		}, this);
	});
});

// trSeq 1,2,3...
function addShareNoteOrNotebook(trSeq) {
	var trId = "#tr" + trSeq;
	var id = Share.dialogNoteOrNotebookId;
	
	var emails = isEmailFromInput(trId + " #friendsEmail", "#shareMsg", "请输入好友邮箱");
	if(!emails) {
		return;
	}
	var shareNotePerm = $(trId + ' input[name="perm' + trSeq + '"]:checked').val() || 0;
	var perm = shareNotePerm;
	// emails = emails.split(";");
	var url = "share/addShareNote";
	var data = {noteId: id, emails: [emails], perm: shareNotePerm};
	if(!Share.dialogIsNote) {
		url = "share/addShareNotebook";
		data = {notebookId: id, emails: [emails], perm: shareNotePerm};
	}
	hideAlert("#shareMsg");
	post(url, data, function(ret) {
		var ret = ret[emails];
		if(ret) {
			// 成功
			// 成功了则去掉输入框
			if(ret.Ok) {
				var tpl = t('<td>?</td>', '#');
				tpl += t('<td>?</td>', emails);
				tpl += t('<td><a href="#" noteOrNotebookId="?" perm="?" toUserId="?" title="点击改变权限" class="btn btn-default change-perm">?</a></td>', id, perm, ret.Id, !perm || perm == '0' ? "只读" : "可编辑");
				tpl += t('<td><a href="#" noteOrNotebookId="?" toUserId="?" class="btn btn-warning delete-share">删除</a></td>', id, ret.Id);
				$(trId).html(tpl);
			} else {
				var shareUrl = 'http://leanote/register?from=' + UserInfo.Username;
				showAlert("#shareMsg", "该用户还没有注册, 复制邀请链接发送给Ta一起来体验leanote, 邀请链接: " + shareUrl + ' <a id="shareCopy"  data-clipboard-target="copyDiv">点击复制</a> <span id="copyStatus"></span> <br /> 或者发送邀请邮件给Ta, <a href="#" onclick="sendRegisterEmail(\'' + emails + '\')">点击发送', "warning");
				$("#copyDiv").text(shareUrl);
				initCopy("shareCopy", function(args) {
					if(args.text) {
						showMsg2("#copyStatus", "复制成功", 1000);
					} else {
						showMsg2("#copyStatus", "对不起, 复制失败, 请自行复制", 1000);
					}
				});
			}
		}
	}, trId + " .btn-success");
}

// 发送邀请邮件
function sendRegisterEmail(email) {
	showDialog2("#sendRegisterEmailDialog", {postShow: function() {
		$("#emailContent").val("Hi, 我是" + UserInfo.Username + ", leanote非常好用, 快来注册吧!");
		setTimeout(function() {
			$("#emailContent").focus();
		}, 500);
		$("#toEmail").val(email);
	}});
}

function deleteShareNoteOrNotebook(trSeq) {
	$("#tr" + trSeq).remove();	
}
